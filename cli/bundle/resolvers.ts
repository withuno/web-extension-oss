import path from "path";

import CONFIG from "@/bundle.config";
import fs from "fs-extra";

/**
 * Get a formatted, destination directory for output.
 */
export function resolveOutDir(...pathParts: string[]) {
  return resolveProjectRoot(CONFIG.outdir, ...pathParts);
}

/**
 * Resolves a path to the root directory
 * of this repository (the "project root").
 */
export function resolveProjectRoot(...pathParts: string[]) {
  return path.resolve(__dirname, "../..", ...pathParts);
}

/**
 * Parse and return the root `package.json` file for this repository.
 */
export async function getPackageJson() {
  const pkgJsonPath = resolveProjectRoot("package.json");
  return JSON.parse((await fs.promises.readFile(pkgJsonPath)).toString("utf-8")) as Record<string, any>;
}
