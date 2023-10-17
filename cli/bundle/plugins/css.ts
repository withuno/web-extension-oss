import path from "path";

import browserslist from "browserslist";
import type { Plugin } from "esbuild";
import fs from "fs-extra";
import lightningcss, { CSSModuleExports, Dependency, UrlDependency } from "lightningcss";
import { camelCase, upperFirst } from "lodash";
import type { Plugin as PostcssPlugin } from "postcss";
import postcssImport from "postcss-import";
import tailwindcss from "tailwindcss";

import { resolveOutDir, resolveProjectRoot } from "../resolvers";
import { BundleContext } from "../types";

function getAbsoluteUrl(resolveDir: string, url: string) {
  const pureUrl = url.replace(/"/g, "").replace(/'/g, "");
  if (path.isAbsolute(pureUrl) || pureUrl.startsWith("http") || pureUrl.startsWith("data:")) {
    return pureUrl;
  }
  return path.resolve(resolveDir, pureUrl);
}

/**
 * The sourcemap created by `lightningcss` needs some slight tweaking to be
 * consistent with sourcemaps created by ESBuild:
 *   - Resolve `sources` to the configured `outdir`
 *   - Convert `sources` to absolute paths.
 */
function patchSourcemap(map: Buffer, outdir: string) {
  const originalMap = JSON.parse(map.toString("utf-8"));
  const patchedMap = {
    ...originalMap,
    sources: [
      ...originalMap.sources.map((s: string) => {
        return path.relative(outdir, path.isAbsolute(s) ? s : `/${s}`);
      }),
    ],
  };

  return Buffer.from(JSON.stringify(patchedMap));
}

interface CssContext {
  filename: string;
  outdir: string;
  minify?: boolean;
  cssModules?: boolean;
  sourcemap?: BundleContext["sourcemap"];
}

function lightningcssPlugin(cssCtx: CssContext): PostcssPlugin {
  return {
    postcssPlugin: lightningcssPlugin.pluginName,
    OnceExit: (root, { result, postcss }) => {
      const intermediateResult = root.toResult({
        map: { inline: true },
      });

      const transformResult = lightningcss.transform({
        code: Buffer.from(intermediateResult.css),
        filename: (root.source && root.source.input.file) || "",
        minify: !!cssCtx.minify,
        cssModules: !!cssCtx.cssModules,
        sourceMap: !!cssCtx.sourcemap,
        analyzeDependencies: true,
        drafts: { nesting: true },
        targets: lightningcss.browserslistToTargets(browserslist("defaults")),
      });

      let code = transformResult.code.toString();

      if (transformResult.map != null) {
        const patchedMap = patchSourcemap(transformResult.map, cssCtx.outdir);
        code += `\n/*# sourceMappingURL=data:application/json;base64,${patchedMap.toString("base64")} */`;
      }

      if (transformResult.exports != null) {
        result.messages.push({
          type: "exports",
          plugin: lightningcssPlugin.pluginName,
          exports: transformResult.exports,
        });
      }

      if (transformResult.dependencies != null) {
        result.messages.push({
          type: "dependencies",
          plugin: lightningcssPlugin.pluginName,
          dependencies: transformResult.dependencies,
        });
      }

      result.root = postcss.parse(code, {
        from: result.opts.from,
        map: true,
      });
    },
  };
}
lightningcssPlugin.pluginName = "web-ext.cli.build:postcss:lightningcss";

async function handleCSS(cssCtx: CssContext) {
  const { default: postcss } = require("postcss") as typeof import("postcss");

  const { default: tailwindConfig } = require(resolveProjectRoot("./tailwind.config.js"));

  const source = await fs.promises.readFile(cssCtx.filename, "utf8");
  const postcssResult = await postcss([
    postcssImport(),
    tailwindcss(tailwindConfig),
    lightningcssPlugin(cssCtx),
  ]).process(source, {
    from: cssCtx.filename,
  });

  let cssContent = postcssResult.css;
  const { messages } = postcssResult;

  const cssModuleExports: CSSModuleExports =
    messages.find((msg) => {
      return msg.plugin === lightningcssPlugin.pluginName && msg.type === "exports";
    })?.exports ?? {};

  const dependencies: Dependency[] =
    messages.find((msg) => {
      return msg.plugin === lightningcssPlugin.pluginName && msg.type === "dependencies";
    })?.dependencies ?? [];

  const urls = dependencies.filter((d) => d.type === "url") as UrlDependency[];
  const resolveDir = path.dirname(cssCtx.filename);
  urls.forEach(({ url, placeholder }) => {
    cssContent = cssContent.replace(new RegExp(`${placeholder}`, "g"), getAbsoluteUrl(resolveDir, url));
  });

  const cssModulesJSON: Record<string, string> = {};
  if (cssCtx.cssModules) {
    Object.keys(cssModuleExports).forEach((originalClass) => {
      cssModulesJSON[
        /^\p{Lu}/u.test(originalClass[0]) ? upperFirst(camelCase(originalClass)) : camelCase(originalClass)
      ] = cssModuleExports[originalClass].name;
    });
  }

  const jsContent = cssCtx.cssModules ? `export default ${JSON.stringify(cssModulesJSON)};` : "export default {}";

  return {
    jsContent,
    cssContent,
  };
}

/**
 * Compiles/optimizes `*.css` files using `postcss` + `tailwindcss` + `lightningcss`.
 */
export function cssPlugin(ctx: BundleContext): Plugin {
  const cssRegex = /\.css$/;
  const cssModulesRegex = /\.modules?\.css$/;
  const extractNamespace = "web-ext.cli.build.css-extract";
  const extractRegex = /\?web-ext\.cli\.build\.css-extract$/;

  return {
    name: "web-ext.cli.build:css",

    async setup(build) {
      const css = new Map<string, string>();

      // Compile/optimize CSS
      build.onLoad({ filter: cssRegex }, async (args) => {
        const { jsContent, cssContent } = await handleCSS({
          filename: args.path,
          outdir: resolveOutDir(),
          minify: !ctx.watch,
          sourcemap: ctx.sourcemap,
          cssModules: cssModulesRegex.test(args.path),
        });

        css.set(args.path, cssContent);

        const jsFileContent = `import "${args.path}?${extractNamespace}";\n${jsContent}`;
        return {
          contents: jsFileContent,
          loader: "js",
        };
      });

      // Extract CSS
      build.onResolve({ filter: extractRegex }, (args) => {
        return {
          path: args.path,
          namespace: extractNamespace,
        };
      });

      build.onLoad({ filter: extractRegex, namespace: extractNamespace }, (args) => {
        const cssContent = css.get(args.path.split("?")[0]);
        if (!cssContent) return null;
        return {
          contents: cssContent,
          loader: "css",
        };
      });
    },
  };
}
