import path from "path";

import { defineConfig, devices } from "@playwright/test";
import isCI from "is-ci";

export const USER_DATA_DIR = path.join(__dirname, "./.artifacts/user-data");
export const CONTEXT_STATE = path.join(__dirname, "./.artifacts/context.json");
export const RESULTS_DIR = path.join(__dirname, "./.artifacts/test-results");
export const REPORT_DIR = path.join(__dirname, "./.artifacts/playwright-report");

export default defineConfig({
  testDir: "./",
  testMatch: "tests/**/*.spec.ts",
  fullyParallel: true,
  reporter: [["html", { outputFolder: REPORT_DIR }]],

  use: {
    baseURL: "https://uno.app",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  outputDir: RESULTS_DIR,
  forbidOnly: isCI, // Fail upon `test.only` in CI.
  retries: isCI ? 2 : 0, // Retry on CI only.
  workers: isCI ? 1 : 3, // Opt out of parallel tests on CI.
  timeout: 60_000,
});
