import path from "path";

import CONFIG from "@/bundle.config";
import chalk from "chalk";
import prettyBytes from "pretty-bytes";

import { getFileSize } from "../utils/fs";
import { Logger } from "../utils/logger";

/**
 * Prints a log of the output file(s) produced by ESBuild.
 */
export async function printArtifacts(filepaths: Array<string> = []) {
  if (!filepaths.length) return;

  filepaths.forEach((filepath) => {
    const relativePath = filepath.split(`${CONFIG.outdir}${path.sep}`)[1];
    Logger.bundle.info(chalk`Built to {gray ${CONFIG.outdir}/}${relativePath}`);
  });
}

/**
 * Prints a log of the output file(s) produced by ESBuild
 * along with the total disk size of the artifact(s).
 */
export async function printArtifactsWithSizeInfo(filepaths: Array<string> = []) {
  if (!filepaths.length) return;

  const sizeInfos = await Promise.all(
    filepaths.map(async (filepath) => {
      const size = await getFileSize(filepath);
      const prettifiedSize = size < 5000 ? `${size} B` : prettyBytes(size);
      const color = size < 5000 ? chalk.green : size > 40000 ? chalk.red : chalk.yellow;
      return `${color(prettifiedSize)}`;
    }),
  );

  filepaths.forEach((filepath, i) => {
    const sizeLabel = chalk`{gray (}${sizeInfos[i]}{gray )}`;
    const relativePath = filepath.split(`${CONFIG.outdir}${path.sep}`)[1];
    Logger.bundle.info(chalk`Built to {gray ${CONFIG.outdir}/}${relativePath} ${sizeLabel}`);
  });
}
