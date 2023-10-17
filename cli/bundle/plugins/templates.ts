import crypto from "crypto";
import path from "path";

import CONFIG from "@/bundle.config";
import ejs, { Data } from "ejs";
import type { Metafile, Plugin } from "esbuild";
import fs from "fs-extra";
import JSON5 from "json5";

import { triggerReload } from "./hot-reload";
import { checkFileExists, getFileDigest, isDirectory } from "../../utils/fs";
import { createWatcher } from "../../utils/watcher";
import { printArtifacts, printArtifactsWithSizeInfo } from "../artifacts";
import { resolveOutDir, resolveProjectRoot } from "../resolvers";
import { BundleContext } from "../types";

export type TemplateBuilder = () => Template[];

export interface Template {
  sourcePath: string;
  outputPath: string;
  data?: Data | ((metafile: Metafile) => Data | Promise<Data>);
}

export namespace TemplateData {
  /**
   * Used by our internal `vendorsPlugin()` to allow vendor chunks to be templated
   * into any entry-point, such as our web extension manifest, or any generated
   * HTML endpoints.
   */
  export const vendors = new Set<string>();

  /**
   * MD5 hash of the data represented in `TemplateData`. We use this to
   * determine if templates should be re-generated between hot-reloads in
   * development.
   */
  let templateDataHash: string | undefined;

  /**
   * @returns a boolean indicating whether EJS templates should be re-generated.
   */
  export function didUpdate() {
    const hash = crypto
      .createHash("md5")
      .update([...vendors].join(":"))
      .digest("hex");

    if (!templateDataHash) {
      templateDataHash = hash;
      return true;
    }
    return templateDataHash !== hash;
  }
}

async function renderTemplate(template: Template, metafile: Metafile): Promise<string[]> {
  const absoluteSourcePath = resolveProjectRoot(template.sourcePath);
  const absoluteOutputPath = resolveOutDir(template.outputPath);

  const artifacts: string[] = [];

  if (await isDirectory(absoluteSourcePath)) {
    const dir = await fs.promises.readdir(absoluteSourcePath);
    const dirArtifacts: string[] = [];

    await Promise.all(
      dir.map(async (item) => {
        dirArtifacts.push(
          ...(await renderTemplate(
            {
              sourcePath: path.join(template.sourcePath, item),
              outputPath: path.join(template.outputPath, item),
              data: template.data,
            },
            metafile,
          )),
        );
      }),
    );

    if (dirArtifacts.length) {
      artifacts.push(absoluteOutputPath);
    }

    return artifacts;
  }

  const didTemplateChange = renderTemplate.cache.has(absoluteSourcePath)
    ? (await getFileDigest(absoluteSourcePath)) !== renderTemplate.cache.get(absoluteSourcePath)
    : true;

  if (await checkFileExists(absoluteSourcePath)) {
    if (absoluteSourcePath.endsWith(".ejs") && (TemplateData.didUpdate() || didTemplateChange)) {
      const templateData = {
        process: { env: { ...process.env } },
        ...(template.data instanceof Function ? await template.data(metafile) : template.data ?? {}),
        vendors: [...TemplateData.vendors],
      };

      return new Promise<string[]>((resolve, reject) => {
        ejs.renderFile(absoluteSourcePath, templateData, async (err, contents) => {
          if (err) {
            reject(err);
            return;
          }
          renderTemplate.cache.set(absoluteSourcePath, await getFileDigest(absoluteSourcePath));
          artifacts.push(absoluteOutputPath);
          fs.outputFile(absoluteOutputPath, contents).then(() => resolve(artifacts));
        });
      });
    }
    if (didTemplateChange) {
      const contents = await fs.readFile(absoluteSourcePath);
      renderTemplate.cache.set(absoluteSourcePath, await getFileDigest(absoluteSourcePath));
      artifacts.push(absoluteOutputPath);
      await fs.outputFile(
        absoluteOutputPath,
        // If the contents are a JSON blob formatted w/comments,
        // strip those comments and cleanup the data.
        (absoluteSourcePath.endsWith(".jsonc") || absoluteSourcePath.endsWith(".json5")) &&
          absoluteOutputPath.endsWith(".json")
          ? JSON.stringify(JSON5.parse(contents.toString()))
          : contents,
      );
    }
  }

  return artifacts;
}

renderTemplate.cache = new Map<string, string | null>();

/*
 * Render static templates to the production output.
 *
 * Optionally, these templates can be rendered with data using EJS.
 * @see https://ejs.co
 */
export function templatesPlugin(ctx: BundleContext, templates: Template[]): Plugin {
  const pluginName = "web-ext.cli.build:templates";

  return {
    name: pluginName,
    setup: async (build) => {
      if (build.initialOptions.write !== false) {
        let metafile: Metafile | undefined;

        if (ctx.watch) {
          await Promise.all(
            CONFIG.watchDirectories.map(async (dir) => {
              const watcher = await createWatcher(resolveProjectRoot(dir));
              watcher.addListener(async () => {
                await Promise.all(
                  templates.map(async (template) => {
                    if (!metafile || build.initialOptions.write === false) {
                      return;
                    }
                    const artifacts = await renderTemplate(template, metafile);
                    if (ctx.watch) {
                      if (artifacts.length) {
                        triggerReload();
                      }
                      // Omit size info during development to speed up re-builds.
                      await printArtifacts(artifacts);
                    } else {
                      await printArtifactsWithSizeInfo(artifacts);
                    }
                  }),
                );
              });
            }),
          );
        }

        build.onEnd(async (args) => {
          metafile = args.metafile;
          if (args.metafile && build.initialOptions.write !== false && !args.errors.length) {
            await Promise.all(
              templates.map(async (template) => {
                const artifacts = await renderTemplate(template, args.metafile!);
                if (ctx.watch) {
                  // Omit size info during development to speed up re-builds.
                  await printArtifacts(artifacts);
                } else {
                  await printArtifactsWithSizeInfo(artifacts);
                }
              }),
            );
          }
        });
      }
    },
  };
}
