import crypto from "crypto";
import path from "path";

import fs from "fs-extra";

/**
 * Resolves to a boolean indicating whether
 * a file located at `filepath` exists.
 */
export async function checkFileExists(filepath: string) {
  return fs.promises
    .access(filepath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

/**
 * Resolves to a boolean indicating whether
 * an item located at `sourcePath` is a file.
 */
export async function isFile(sourcePath: string) {
  if (!(await checkFileExists(sourcePath))) {
    return false;
  }
  const stats = await fs.stat(sourcePath);
  return stats.isFile();
}

/**
 * Resolves to a boolean indicating whether
 * an item located at `sourcePath` is a directory.
 */
export async function isDirectory(sourcePath: string) {
  if (!(await checkFileExists(sourcePath))) {
    return false;
  }
  const stats = await fs.stat(sourcePath);
  return stats.isDirectory();
}

/**
 * Calculates the total disk size of a file located at `filepath`.
 */
export async function getFileSize(filepath: string): Promise<number> {
  if (!(await checkFileExists(filepath))) {
    return 0;
  }

  if (await isDirectory(filepath)) {
    const files = await fs.promises.readdir(filepath);
    const sizes = await Promise.all(
      files.map((file) => {
        return getFileSize(path.join(filepath, file));
      }),
    );
    return sizes.reduce((acc, size) => acc + size, 0);
  }

  const stats = await fs.stat(filepath);
  return stats.size;
}

/**
 * Computes a hash against the contents of a file located at `filepath`.
 */
export async function getFileDigest(filepath: string) {
  if (!(await checkFileExists(filepath))) {
    return null;
  }

  if (await isDirectory(filepath)) {
    return null;
  }

  return crypto
    .createHash("md5")
    .update(await fs.readFile(filepath))
    .digest("hex");
}
