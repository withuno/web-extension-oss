type RequiredEnvVar<Type extends string = string> = Type;
type OptionalEnvVar<Type extends string = string> = Type | undefined;

/**
 * Environment variables utilized within repo scripts (e.g.: "cli/").
 *
 * These variables should NOT be reflected in "*.env" files as they're not
 * required in the built extension.
 */
interface RuntimeEnvironment {
  // Build config overrides
  OUTDIR: OptionalEnvVar;
  PACKAGE: OptionalEnvVar<"true" | "false">;

  // Sentry (runtime)
  SENTRY_AUTH_TOKEN: OptionalEnvVar;
  SENTRY_ORG: OptionalEnvVar;
  SENTRY_PROJECT: OptionalEnvVar;
}

/**
 * Environment variables exposed to the client bundles at build time.
 * Generally-speaking, these variables should be reflected in all "*.env" files.
 */
interface BundleEnvironment {
  // App variables
  NODE_ENV: RequiredEnvVar<"production" | "development">;
  ENV_NAME: RequiredEnvVar<"production" | "development" | "internal" | "e2e">;
  APP_NAME: RequiredEnvVar;
  API_SERVER: RequiredEnvVar;
  SEGMENT_API_KEY: RequiredEnvVar;
  NATIVE_HOST_ID: RequiredEnvVar;
  GIT_COMMIT_HASH: RequiredEnvVar;
  GIT_BRANCH: RequiredEnvVar;
  GIT_STATUS: RequiredEnvVar;
  EXT_VERSION: RequiredEnvVar;
  WATCH: OptionalEnvVar<"true" | "false">;

  // Sentry (build time)
  SENTRY_DSN: RequiredEnvVar;

  // OAuth flow
  CLIENT_ID_WEB_AUTH_FLOW: RequiredEnvVar;
  WEB_CLIENT_SECRET: RequiredEnvVar;

  // Manifest variables
  MANIFEST_KEY: RequiredEnvVar;
  CLIENT_ID: RequiredEnvVar;
  FIREFOX_ID: RequiredEnvVar;
  EXTENSION_ID: RequiredEnvVar;
}

// Extend the global NodeJS interface to extend `ProcessEnv` types.
declare namespace NodeJS {
  interface ProcessEnv extends RuntimeEnvironment, BundleEnvironment {}
}
