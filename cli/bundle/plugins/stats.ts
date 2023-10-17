import chalk from "chalk";
import { Plugin, Message } from "esbuild";
import { Logger as FlikLogger } from "flik";

import { Logger } from "../../utils/logger";
import { printArtifacts, printArtifactsWithSizeInfo } from "../artifacts";
import { BundleContext } from "../types";

async function reportErrors(errors: Message[]) {
  Logger.bundle.error(chalk`{red Build failed}`);
  FlikLogger.visualSeparator();
  errors.forEach((err) => {
    console.error(formatError(err));
    FlikLogger.visualSeparator();
  });
  FlikLogger.visualSeparator();
}

function formatError(error: Message) {
  const result: string[] = [];

  result.push(
    error.location
      ? chalk`{cyan ${error.location?.file}}:{yellow ${error.location?.line}}:{yellow ${error.location?.column}} - ${error.text}`
      : error.text,
  );

  if (error.location) {
    result.push(
      chalk`\n{inverse ${error.location.line}} ${error.location.lineText}`,
      chalk.inverse(" ").repeat(String(error.location.line).length) +
        " ".repeat(error.location.column + 1 || 0) +
        chalk.red("~").repeat(error.location?.length ?? 1),
    );
  }

  return result.join("\n");
}

/**
 * Perform type-checking and generate type
 * definitions based on files resolved in the bundle.
 */
export function statsPlugin(ctx: BundleContext): Plugin {
  const pluginName = `web-ext.cli.build:stats`;

  return {
    name: pluginName,
    setup: (build) => {
      let isInitialBuild = true;
      build.onStart(() => {
        if (ctx.watch && !isInitialBuild) {
          Logger.bundle.info(chalk`File change detected; rebuilding...`);
        }
        isInitialBuild = false;
      });

      build.onEnd(async (result) => {
        if (result.errors.length) {
          return reportErrors(result.errors);
        }
        const outputs = Object.keys(result.metafile?.outputs ?? {});
        const jsOutput = outputs.filter((o) => o.endsWith("js"));
        const cssOutput = outputs.filter((o) => o.endsWith("css"));
        if (ctx.watch) {
          // Omit size info during development to speed up re-builds.
          // (we don't optimize development artifacts anyways, so the size info is useless/misleading).
          await printArtifacts([...jsOutput, ...cssOutput]);
        } else {
          await printArtifactsWithSizeInfo([...jsOutput, ...cssOutput]);
        }
      });
    },
  };
}
