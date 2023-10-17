import archiver from "archiver";
import chalk from "chalk";
import fastGlob from "fast-glob";
import fs from "fs-extra";
import prettyBytes from "pretty-bytes";

import { resolveOutDir, resolveProjectRoot } from "./resolvers";
import { Logger } from "../utils/logger";

/**
 * Compresses built outputs into a ZIP archive.
 */
export async function archiveOutputs() {
  const pkgJsonFilePath = resolveProjectRoot("package.json");
  const pkgJsonVersion: string = JSON.parse(fs.readFileSync(pkgJsonFilePath).toString("utf-8")).version;
  const zipLabel = `uno-v${pkgJsonVersion}`;

  const relevantFiles = await fastGlob(resolveOutDir("./**/*"), {
    dot: true,
  });

  return new Promise<void>((resolve, reject) => {
    Logger.bundle.async.pending("Compressing outputs...");

    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    const zipPath = resolveProjectRoot(`./${zipLabel}.zip`);

    const output = fs.createWriteStream(zipPath);

    // Listen for all archive data to be written.
    output.on("close", () => {
      const size = archive.pointer();
      const prettifiedSize = size < 5000 ? `${size} B` : prettyBytes(size);
      const color = size < 5000 ? chalk.green : size > 40000 ? chalk.red : chalk.yellow;
      const sizeLabel = `${color(prettifiedSize)}`;

      Logger.bundle.async.complete(chalk`Total compressed size: ${sizeLabel}`);

      resolve();
    });

    // Catch errors and reject accordingly.
    archive.on("error", (err) => {
      reject(err);
    });

    // Pipe archive data to the output file.
    archive.pipe(output);

    // Append files from a sub-directory, placing its contents at the root of archive.
    relevantFiles.forEach((sourceFileName) => {
      archive.file(sourceFileName, {
        name: sourceFileName.replace(resolveOutDir(), "."),
      });
    });

    // Start compressing...
    archive.finalize();
  });
}
