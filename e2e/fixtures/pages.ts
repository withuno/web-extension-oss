import type { BrowserContext, Page } from "@playwright/test";
import { deserializeError } from "serialize-error";
import { v4 as uuid } from "uuid";

import type { BaseFixture } from "./base";
import type { EventsFixture } from "./events";
import { ExtractTestEventData, TestContext, TestEvent, TestFixtureExtension } from "../types";

export interface PagesFixture {
  /**
   * Overrides the default test page with one that wires-up message channel
   * functionality between the Playwright process and the browser page.
   */
  page: Page;

  /**
   * @returns a unique UUID to identify the page for the current test.
   */
  pageID: string;

  /**
   * @returns the extension ID.
   */
  extensionID: string;

  /**
   * Create a new page with test events wired-up on the target browser
   * context, if provided, or the default context otherwise.
   */
  createPage(context?: BrowserContext): Promise<Page>;

  /**
   * @returns the extension's background page.
   */
  getBackgroundPage(): Promise<Page>;

  /**
   * @returns a promise that resolves once the in-page orchestrator is
   * initialized.
   */
  orchestratorInitialized(target?: Page): Promise<any>;

  /**
   * Initialize an ephemeral test user for the current test suite.
   */
  initializeTestUser(): Promise<TestContext["testUsers"][number]>;

  /**
   * Open a new page with the current browser context, prefixed with the
   * extension's protocol and ID.
   *
   * (e.g.: "chrome-extension://{extensionID}/{pagePath}")
   */
  openExtensionPage(pagePath: string): Promise<Page>;

  /**
   * Opens the extension popup ("chrome-extension://{extensionID}/popup.html")
   */
  openExtensionPopup(): Promise<Page>;
}

export const PagesFixture: TestFixtureExtension<PagesFixture, BaseFixture & EventsFixture> = {
  async page({ createPage }, use) {
    await use(await createPage());
  },

  async pageID({}, use) {
    await use(uuid());
  },

  async extensionID({ getBackgroundPage }, use) {
    const background = await getBackgroundPage();
    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },

  async createPage({ context, baseURL, extensionID }, use) {
    await use(async (target) => {
      const newPage = await (target || context).newPage();

      // Listen for logs from the new page, print to stdout if the log comes
      // from the `E2E.log` client-side method.
      newPage.on("console", (msg) => {
        if (msg.text().includes("[E2E.log]")) {
          const sourceURL = msg.page()?.url() ? new URL(msg.page()!.url()) : null;
          const friendlySourceURL = sourceURL?.hostname === extensionID ? sourceURL.pathname : sourceURL?.host ?? null;
          const prefix = friendlySourceURL ? `[E2E.log -> ${friendlySourceURL}]` : `[E2E.log]`;
          console.log(prefix, msg.text().replace("[E2E.log] ", ""));
        }
      });

      // Initialize each page with a script that tracks `TestEvent` types in
      // <meta> elements. This allows us to wait for specific test events to be
      // received or query for test events that happened in the past.
      await newPage.addInitScript(() => {
        (() => {
          // TODO: parameterize for iframes?
          if (window !== window.top) {
            return;
          }

          window.addEventListener("__uno_e2e_meta_event__", (e) => {
            const innerEvent = e.detail;
            const metaEl = document.createElement("meta");
            metaEl.classList.add("__uno_e2e_event_buffer__");
            metaEl.setAttribute("name", innerEvent.type);
            if (innerEvent.detail) {
              const { _requestID, ...detail } = innerEvent.detail;
              metaEl.setAttribute("content", JSON.stringify(detail ?? {}));
              if (_requestID) {
                metaEl.setAttribute("request-id", _requestID);
              }
            }
            document.head.append(metaEl);
          });
        })();
      });

      await newPage.goto(baseURL!);
      return newPage;
    });
  },

  async getBackgroundPage({ context }, use) {
    await use(async () => {
      // Manifest V2:
      let [background] = context.backgroundPages();
      if (!background) {
        background = await context.waitForEvent("backgroundpage");
      }

      // TODO: (MANIFEST_V3)
      // let [background] = context.serviceWorkers();
      // if (!background) {
      //   background = await context.waitForEvent("serviceworker");
      // }

      return background;
    });
  },

  async orchestratorInitialized({ waitForTestEvent }, use) {
    await use(async (target) => {
      return waitForTestEvent(TestEvent.Type.OrchestratorInitialized, { target });
    });
  },

  async initializeTestUser({ page, createTestEventAPI, orchestratorInitialized, setTestContext }, use) {
    await use(async () => {
      await page.goto("/");
      await orchestratorInitialized();

      const doInitializeTestUser = await createTestEventAPI({
        dispatchEvent: TestEvent.Type.InitializeTestUser,
        successEvent: TestEvent.Type.InitializeTestUserSuccess,
        errorEvent: TestEvent.Type.InitializeTestUserError,
      });

      const testUser = await doInitializeTestUser()
        .then(async (testUser) => {
          await setTestContext((ctx) => ({
            testUsers: [...ctx.testUsers, testUser],
          }));
          return testUser;
        })
        .catch((reason: ExtractTestEventData<TestEvent.Type.InitializeTestUserError>) => {
          throw deserializeError(reason.error);
        });

      return testUser;
    });
  },

  async openExtensionPage({ createPage, extensionID, orchestratorInitialized }, use) {
    await use(async (pagePath) => {
      const newPage = await createPage();
      await newPage.goto(`chrome-extension://${extensionID}/${pagePath}`);
      await orchestratorInitialized(newPage);
      return newPage;
    });
  },

  async openExtensionPopup({ page, openExtensionPage }, use) {
    await use(async () => {
      const popupPage = await openExtensionPage("popup.html");
      await page.bringToFront();
      return popupPage;
    });
  },
};
