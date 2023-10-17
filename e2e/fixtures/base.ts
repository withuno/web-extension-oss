import path from "path";

import { chromium, BrowserContext } from "@playwright/test";
import fs from "fs-extra";
import { v4 as uuid } from "uuid";

import { CONTEXT_STATE, USER_DATA_DIR } from "../playwright.config";
import type { TestContext, TestFixtureExtension } from "../types";

export interface BaseFixture {
  /**
   * Overrides the default browser context with one that supports installing our
   * development extension build.
   */
  context: BrowserContext;

  /**
   * A unique UUID to identify the browser context for the current process.
   */
  contextID: string;

  /**
   * Get contextual state shared between tests.
   */
  getTestContext(): Promise<TestContext>;

  /**
   * Set contextual state shared between tests.
   */
  setTestContext(state: Partial<TestContext>): Promise<void>;
  setTestContext(reducer: (ctx: TestContext) => TestContext): Promise<void>;
}

export const BaseFixture: TestFixtureExtension<BaseFixture> = {
  async context({ contextID }, use) {
    const pathToExtension = path.join(__dirname, "../../dist"); // TODO: what if `OUTDIR` environment variable is set?
    const tmpUserDataDir = path.join(USER_DATA_DIR, contextID);
    const context = await chromium.launchPersistentContext(tmpUserDataDir, {
      headless: false,
      args: [
        `--headless=new`, // the new headless arg for Chrome v109+
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await use(context);
    await context.close();
    await fs.remove(tmpUserDataDir);
  },

  async contextID({}, use) {
    await use(uuid());
  },

  async getTestContext({}, use) {
    await use(async () => {
      const ctx = await fs.readJSON(CONTEXT_STATE, { throws: false }).catch(() => null);

      const initialCtx: TestContext = {
        testUsers: [],
      };

      return ctx ?? initialCtx;
    });
  },

  async setTestContext({ getTestContext }, use) {
    await use(async (input) => {
      const currentContext = await getTestContext();
      const nextContext = input instanceof Function ? input(currentContext) : { ...currentContext, ...input };
      await fs.writeJSON(CONTEXT_STATE, nextContext);
    });
  },
};
