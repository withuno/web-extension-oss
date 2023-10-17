import crypto from "crypto";

import dedent from "dedent";
import esbuild, { BuildOptions, Plugin } from "esbuild";
import fs from "fs-extra";

import { TemplateData } from "./templates";
import { resolveOutDir, resolveProjectRoot } from "../resolvers";

/**
 * A plugin that looks at the dependency graph for `node_modules` dependencies
 * and splits those dependencies into separate bundles.
 */
export function vendorsPlugin(): Plugin {
  const pluginName = "web-ext.cli.build:vendors";

  return {
    name: pluginName,
    setup: async (build) => {
      const vendorModules = new Set<string>();
      const skipResolve = {};

      build.onResolve({ filter: /.*/, namespace: "file" }, async (args) => {
        if (args.pluginData === skipResolve) {
          return;
        }

        const resolved = await build.resolve(args.path, {
          kind: args.kind,
          resolveDir: args.resolveDir,
          pluginData: skipResolve,
        });

        const isNodeModule = resolved.path.startsWith(resolveProjectRoot("node_modules"));

        if (isNodeModule && !/\.css$/.test(args.path)) {
          vendorModules.add(args.path);
          return {
            path: args.path,
            external: true,
          };
        }
      });

      build.onEnd(async (args) => {
        if (!args.errors.length && build.initialOptions.write !== false) {
          TemplateData.vendors.clear();
          await fs.remove(resolveOutDir("vendor"));
          await createVendorBundles([...vendorModules], {
            define: build.initialOptions.define,
            platform: build.initialOptions.platform,
            target: build.initialOptions.target,
          });
        }
      });
    },
  };
}

/**
 * For each of the `node_modules` dependencies given by `chunks`, creates a
 * separate bundle for that dependency.
 *
 * This additional complexity is an unfortunate requirement to work around
 * Firefox's hard-limit of 4mb per JavaScript file included in a manifest.
 */
async function createVendorBundles(chunks: string[], buildOptions: BuildOptions) {
  await createVendorRuntime();

  const commonBuildOptions: BuildOptions = {
    ...buildOptions,
    logLevel: "silent",
    format: "cjs",
    bundle: true,
    minify: true,
    metafile: true,
    sourcemap: false,
  };

  await Promise.all(
    chunks
      .map((chunk) => {
        const chunkContents = dedent`
          Object.defineProperty(window.__uno_vendors__, '${chunk}', {
            get() {
              return require('${chunk}');
            }
          });
        `;

        const hash = crypto.createHash("md5").update(chunk).digest("hex");
        const chunkBundleName = `vendors/${hash}.js`;
        const chunkOutfile = resolveOutDir(chunkBundleName);

        TemplateData.vendors.add(chunkBundleName);

        return { chunk, chunkContents, chunkOutfile };
      })
      .map(async ({ chunk, chunkContents, chunkOutfile }) => {
        await esbuild.build({
          ...commonBuildOptions,
          plugins: [externalizeVendorChunks(chunk, chunks)],
          banner: { js: "(() => {" }, // Wrap the chunk...
          footer: { js: "})();" }, //    ...in an IIFE
          stdin: {
            contents: chunkContents,
            resolveDir: resolveProjectRoot(),
          },
          outfile: chunkOutfile,
        });
      }),
  );
}

/**
 * Outputs a file to bootstrap our code-splitting strategy for vendor bundles.
 * This should be the first script included by any zone's runtime execution
 * context.
 */
async function createVendorRuntime() {
  const runtimeBundleName = "vendors/runtime.js";
  const runtimeOutfile = resolveOutDir("vendors/runtime.js");
  const runtimeContent = dedent`
    window.__uno_vendors__ = window.__uno_vendors__ || {};
    function require(key) { return window.__uno_vendors__[key] };
  `;
  await fs.outputFile(runtimeOutfile, runtimeContent);
  TemplateData.vendors.add(runtimeBundleName);
}

/**
 * This plugin is used internally by `createVendorBundles(...)`. Within the
 * vendor chunks we generate, we want to externalize `node_modules` that
 * reference other vendor bundles.
 */
function externalizeVendorChunks(thisChunk: string, allVendorChunks: string[]): Plugin {
  const pluginName = "web-ext.cli.build:vendors:externalize-vendor-chunks";

  return {
    name: pluginName,
    setup: async (build) => {
      const filter = /^[^./]|^\.[^./]|^\.\.[^/]/; // Must not start with "/" or "./" or "../"
      build.onResolve({ filter }, (args) => {
        if (args.path !== thisChunk && allVendorChunks.includes(args.path)) {
          return {
            path: args.path,
            external: true,
          };
        }
      });
    },
  };
}
