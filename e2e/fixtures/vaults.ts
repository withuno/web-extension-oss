import type { Response } from "@playwright/test";
import { deserializeError } from "serialize-error";
import { v4 as uuid } from "uuid";

import type { BaseFixture } from "./base";
import type { EventsFixture } from "./events";
import { PagesFixture } from "./pages";
import { TestContext, ExtractTestEventData, TestEvent, TestFixtureExtension } from "../types";

export namespace TestVaults {
  export interface CreateTestVault {
    (user: TestContext["testUsers"][number]): any;
  }

  export namespace V7 {
    export const empty: CreateTestVault = ({ email }) => ({
      email,
      vaultSchemaMinor: 0,
      vaultSchemaMajor: 7,
      uuid: uuid(),
      vault: [],
      manualItems: [],
      contacts: [],
      confidants: [],
      oldPasswords: [],
      privateKeys: [],
    });

    export const withGoogleLogin: CreateTestVault = ({ email }) => ({
      email,
      vaultSchemaMinor: 0,
      vaultSchemaMajor: 7,
      uuid: uuid(),
      vault: [],
      manualItems: [
        {
          name: "google.com",
          url: "www.google.com",
          username: "test+google@uno.app",
          password: "Qwerty1234!",
          otpSeed: null,
          notes: "",
          id: uuid(),
          relatedItems: [],
          ssoProvider: [],
          matching_hosts: ["www.google.com"],
        },
      ],
      contacts: [],
      confidants: [],
      oldPasswords: [],
      privateKeys: [],
    });
  }
}

export interface VaultsFixture {
  /**
   * @returns a URL object reprensenting Uno's backend API endpoint.
   */
  backendURL: URL;

  /**
   * Waits for a signed backend response. If the response status is initially
   * "401 unauthorized", a second response is awaited to allow the extension's
   * `VaultService` to sign the request with the latest VClock.
   */
  waitForSignedBackendResponse: (options: { endpoint: string; method: string }) => Promise<Response>;

  /**
   * Injects mock vault data into the current page.
   */
  injectVaultData(vault: any): Promise<any>;

  /**
   * Resolves to the current state of vault data in the current page.
   */
  getVaultData(): Promise<any>;

  /**
   * Resolves to the ID of the vault data in the current page.
   */
  getVaultID(): Promise<string>;
}

type Dependencies = BaseFixture & PagesFixture & EventsFixture;

export const VaultsFixture: TestFixtureExtension<VaultsFixture, Dependencies> = {
  async backendURL({}, use) {
    await use(new URL(process.env.API_SERVER));
  },

  async waitForSignedBackendResponse({ getBackgroundPage, backendURL }, use) {
    const backgroundPage = await getBackgroundPage();

    await use(async ({ endpoint, method }) => {
      const res = await backgroundPage.waitForResponse((res) => {
        const req = res.request();
        return req.method() === method && req.url() === new URL(endpoint, backendURL).href;
      });
      if (res.status() === 401) {
        return backgroundPage.waitForResponse((res) => {
          const req = res.request();
          return req.method() === method && req.url() === new URL(endpoint, backendURL).href;
        });
      }
      return res;
    });
  },

  async injectVaultData({ createTestEventAPI }, use) {
    const doInjectVaultData = await createTestEventAPI({
      dispatchEvent: TestEvent.Type.InjectTestVaultData,
      successEvent: TestEvent.Type.InjectTestVaultDataSuccess,
      errorEvent: TestEvent.Type.InjectTestVaultDataError,
    });

    await use(async (vault) => {
      return doInjectVaultData({ vault })
        .then(({ vault }) => vault)
        .catch((reason: ExtractTestEventData<TestEvent.Type.InjectTestVaultDataError>) => {
          throw deserializeError(reason.error);
        });
    });
  },

  async getVaultData({ createTestEventAPI }, use) {
    const doGetVaultData = await createTestEventAPI({
      dispatchEvent: TestEvent.Type.GetTestVaultData,
      successEvent: TestEvent.Type.GetTestVaultDataSuccess,
      errorEvent: TestEvent.Type.GetTestVaultDataError,
    });

    await use(async () => {
      return doGetVaultData()
        .then(({ vault }) => vault)
        .catch((reason: ExtractTestEventData<TestEvent.Type.GetTestVaultDataError>) => {
          throw deserializeError(reason.error);
        });
    });
  },

  async getVaultID({ createTestEventAPI }, use) {
    const doGetVaultID = await createTestEventAPI({
      dispatchEvent: TestEvent.Type.GetTestVaultID,
      successEvent: TestEvent.Type.GetTestVaultIDSuccess,
      errorEvent: TestEvent.Type.GetTestVaultIDError,
    });

    await use(async () => {
      return doGetVaultID()
        .then(({ id }) => id)
        .catch((reason: ExtractTestEventData<TestEvent.Type.GetTestVaultIDError>) => {
          throw deserializeError(reason.error);
        });
    });
  },
};
