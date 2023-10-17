import CONFIG from "@/bundle.config";
import esbuild, { BuildOptions } from "esbuild";

import { defineEnv, injectBuildTimeEnv, loadEnv } from "./env";
import { cssPlugin } from "./plugins/css";
import { globImport } from "./plugins/glob-import";
import { hotReload } from "./plugins/hot-reload";
import { statsPlugin } from "./plugins/stats";
import { templatesPlugin } from "./plugins/templates";
import { vendorsPlugin } from "./plugins/vendors";
import { resolveOutDir, resolveProjectRoot } from "./resolvers";
import { uploadSourcemaps } from "./sourcemaps";
import { createTypeChecker } from "./type-checker";
import { DisposeFunction, BundleContext } from "./types";

/**
 * Bundle with ESBuild.
 */
export async function bundle(ctx: BundleContext): Promise<DisposeFunction | undefined> {
  await injectBuildTimeEnv(ctx);
  const env = await loadEnv(ctx.envFile);

  await createTypeChecker(ctx);

  const buildOptions: BuildOptions = {
    entryPoints: CONFIG.entryPoints,
    outdir: resolveOutDir(),
    outbase: resolveProjectRoot(),
    logLevel: "silent",
    entryNames: "[name]",
    platform: "browser",
    target: "esnext",
    format: "cjs",
    bundle: true,
    metafile: true,
    minify: !ctx.watch,
    sourcemap: ctx.sourcemap ?? false,
    define: defineEnv(env) as any,
    plugins: [
      vendorsPlugin(),
      cssPlugin(ctx),
      globImport(),
      hotReload(ctx),
      statsPlugin(ctx),
      templatesPlugin(ctx, CONFIG.templates()),
    ].filter(Boolean),
  };

  if (ctx.watch) {
    const buildContext = await esbuild.context<BuildOptions>(buildOptions);
    await buildContext.watch();
    return buildContext.dispose;
  }
  await esbuild.build<BuildOptions>(buildOptions);
  await uploadSourcemaps(ctx);
}
