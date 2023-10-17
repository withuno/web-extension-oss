import SentryCli from "@sentry/cli";
import { shutdown } from "flik";
import { rimraf } from "rimraf";

import { resolveOutDir } from "./resolvers";
import { BundleContext } from "./types";
import { Logger } from "../utils/logger";

export async function uploadSourcemaps(ctx: BundleContext) {
  if (!ctx.watch) {
    const canUploadSourcemaps =
      !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT && !!process.env.SENTRY_AUTH_TOKEN;

    if (ctx.uploadSourcemap && !canUploadSourcemaps) {
      Logger.bundle.warn(
        `Sourcemaps were generated using the "external" target, but insufficient credentials were provided to upload sourcemaps to Sentry.`,
      );
      await rimraf(resolveOutDir("**/*.map"), { glob: true });
    } else if (ctx.uploadSourcemap && canUploadSourcemaps) {
      try {
        Logger.bundle.async.pending("Uploading source-maps to Sentry...");

        const sentry = new SentryCli(null, {
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          silent: true,
        });

        await sentry.releases.new(process.env.EXT_VERSION);
        await sentry.releases.setCommits(process.env.EXT_VERSION, {
          auto: true,
          ignoreMissing: true,
        });
        await sentry.execute(["sourcemaps", "inject", resolveOutDir()], true);
        await sentry.releases.uploadSourceMaps(process.env.EXT_VERSION, {
          include: [resolveOutDir()],
          useArtifactBundle: true,
        });

        await rimraf(resolveOutDir("**/*.map"), { glob: true });

        Logger.bundle.async.complete("Successfully uploaded source-maps!");
      } catch (err) {
        Logger.bundle.error("Failed to upload source-maps:");
        console.error(err);
        shutdown(1);
      }
    } else if (!ctx.uploadSourcemap && ctx.removeSourcemap === true) {
      await rimraf(resolveOutDir("**/*.map"), { glob: true });
    }
  }
}
