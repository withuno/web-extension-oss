import chalk from "chalk";
import { parse as dotenv } from "dotenv";
import { shutdown } from "flik";
import fs from "fs-extra";
import { simpleGit } from "simple-git";

import { resolveProjectRoot } from "./resolvers";
import { BundleContext } from "./types";
import { checkFileExists } from "../utils/fs";
import { Logger } from "../utils/logger";

/**
 * Using `env` as the target environment file,
 * parse and return environment data.
 */
export async function loadEnv(env?: string): Promise<Record<string, string | undefined>> {
  if (env != null) {
    const filepath = resolveProjectRoot(env);

    if (await checkFileExists(filepath)) {
      return parseEnv(filepath).then((result) => {
        Logger.env.success(chalk`Loaded environment (from: {cyan ${env}})`);
        return result;
      });
    }

    Logger.env.warn(chalk`Skipped environment (file doesn't exist: {cyan ${env}})`);
    return {};
  }

  return {};
}

/**
 * Inject environment variables gleaned from
 * external sources and/or current build options.
 */
export async function injectBuildTimeEnv(ctx: BundleContext) {
  // Injects some Git metadata into the following environment variables:
  //   - GIT_COMMIT_HASH
  //   - GIT_BRANCH
  //   - GIT_STATUS
  const git = simpleGit(resolveProjectRoot());
  process.env.GIT_COMMIT_HASH = await git.revparse(["--short", "HEAD"]);
  process.env.GIT_BRANCH = await git.revparse(["--abbrev-ref", "HEAD"]);
  process.env.GIT_STATUS = (await git.diff(["--quiet"])) || "dirty";

  // Injects the current extension version, gleaned from `package.json`.
  // Note: we strip the "preid" ("-next") from pre-release versions.
  const pkgJsonFilePath = resolveProjectRoot("package.json");
  const pkgJsonVersion: string = JSON.parse(fs.readFileSync(pkgJsonFilePath).toString("utf-8")).version;
  process.env.EXT_VERSION = pkgJsonVersion.replace("-next", "");

  // Injects the following environment variables corresponding to
  // `BundleContext` values for this build:
  //   - WATCH
  if (ctx.watch) {
    process.env.WATCH = "true";
  }
}

/**
 * Takes an environment definition (`env`, loaded using `loadEnv()`)
 * and applies those definitions to the following globals:
 *
 *   - {key}
 *   - process.env.{key}
 *   - global.process.env.{key}
 *   - globalThis.process.env.{key}
 *   - import.meta.env.{key}
 */
export function defineEnv(env: Record<string, string | undefined> = {}): Record<string, string> {
  type DefinitionEntry = Array<[string, string]>;

  const createDefinition = (key: string, value: string): DefinitionEntry => {
    return [
      [key, value],
      [`process.env.${key}`, value],
      [`global.process.env.${key}`, value],
      [`globalThis.process.env.${key}`, value],
      [`import.meta.env.${key}`, value],
    ];
  };

  return Object.fromEntries([
    ...Object.entries(env).reduce(
      (entries, [key, value]) =>
        entries.concat(createDefinition(key, typeof value !== "undefined" ? JSON.stringify(value) : "undefined")),
      [] as DefinitionEntry,
    ),
  ]);
}

/**
 * Parses a `.env` file and interpolates variables referenced from `process.env`.
 * Variables already set in `process.env` take precedence over those defined
 * statically in the `.env` file.
 */
async function parseEnv(filepath: string): Promise<Record<string, string | undefined>> {
  const result: Record<string, string | undefined> = {};

  try {
    const envFileContents = await fs.promises.readFile(filepath, "utf8");
    const parsed = dotenv(envFileContents) ?? {};

    for (const [key, value] of Object.entries(parsed)) {
      const interpolationRegex = /^\${(.+)}$/;
      const matches = value.match(interpolationRegex);
      if (matches && matches.length) {
        const interpolatedValue = process.env[matches[1]];
        result[key] = interpolatedValue;
        process.env[key] = interpolatedValue;
      } else if (process.env[key] == null) {
        result[key] = parsed[key];
        process.env[key] = parsed[key];
      } else {
        // Override variables already set in the runtime environment.
        result[key] = process.env[key];
      }
    }
  } catch (err: any) {
    Logger.env.error(err.message);
    await shutdown(1);
  }

  return result;
}
