import type { BundleConfig } from "@/cli/bundle/types";

export default {
  outdir: process.env.OUTDIR ?? "dist",

  entryPoints: [
    "./v2/background.entry.ts",
    "./v2/content.entry.tsx",
    "./v2/debug-view-vault.entry.tsx",
    "./v2/injected.entry.css",
    "./v2/onboard.entry.tsx",
    "./v2/pages.entry.tsx",
    "./v2/popup.entry.tsx",

    // @start V1_COMPAT
    "./v1/content/globals.css",
    // @end V1_COMPAT
  ],

  templates: () => [
    {
      sourcePath: "v2/templates/manifest/manifest.v2.ejs",
      outputPath: "manifest.json",
    },

    // TODO: (MANIFEST_V3)
    // {
    //   sourcePath: "v2/templates/manifest/manifest.v3.ejs",
    //   outputPath: "manifest.json",
    // },

    // TODO: (MANIFEST_V3)
    // {
    //   sourcePath: "v2/templates/background.entry.v3.ejs",
    //   outputPath: "background.entry.mv3.js",
    // },

    {
      sourcePath: "v2/images",
      outputPath: "images",
    },

    {
      sourcePath: "v2/wasm/wsm_bg.wasm",
      outputPath: "wsm_bg.wasm",
    },

    {
      sourcePath: "v2/templates/html/debug-view-vault.ejs",
      outputPath: "debug-view-vault.html",
    },

    {
      sourcePath: "v2/templates/html/onboard.ejs",
      outputPath: "onboard.html",
    },

    {
      sourcePath: "v2/templates/html/pages.ejs",
      outputPath: "pages.html",
    },

    {
      sourcePath: "v2/templates/html/popup.ejs",
      outputPath: "popup.html",
    },

    {
      sourcePath: "v2/templates/locales",
      outputPath: "_locales",
    },

    {
      sourcePath: "v2/templates/memorable-password-word-list.jsonc",
      outputPath: "memorable-password-word-list.json",
    },

    process.env.ENV_NAME === "production"
      ? {
          sourcePath: "v2/templates/credentials-prd.json",
          outputPath: "credentials.json",
        }
      : {
          sourcePath: "v2/templates/credentials-dev.json",
          outputPath: "credentials.json",
        },

    // @start V1_COMPAT
    { sourcePath: "v1/modals", outputPath: "modals" },
    // @end V1_COMPAT
  ],

  watchDirectories: ["v1", "v2", "e2e"],
} satisfies BundleConfig;
