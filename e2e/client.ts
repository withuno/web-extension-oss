import type { UnoOrchestrator } from "@/v2/orchestrator";
import { serializeError } from "serialize-error";
import { v4 as uuid } from "uuid";

import { ExtractTestEvent, ExtractTestEventData, TestEvent } from "./types";

/**
 * A collection of utilities and abstractions for interacting with
 * the E2E testing runtime from the extension's client-side code.
 */
export namespace E2E {
  export enum TestID {
    CommandMenu = "uno/testid/command-menu",
    CommandSubmenu = "uno/testid/command-submenu",

    PopupRoot = "uno/testid/popup/root",
    PopupIndexAddVaultItemButton = "uno/testid/popup/index/add-vault-item-button",
    PopupIndexAddLoginItemButton = "uno/testid/popup/index/add-login-item-button",
    PopupConfirmDeleteButton = "uno/testid/popup/confirm-delete-button",

    LoginItemEditButton = "uno/testid/popup/login-item/edit-button",
    LoginItemFormSaveButton = "uno/testid/popup/login-item/form/save-button",
    LoginItemDeleteButton = "uno/testid/popup/login-item/delete-button",
    LoginItemFormRoot = "uno/testid/popup/login-item/form/root",
    LoginItemFormUsernameField = "uno/testid/popup/login-item/form/username-field",
    LoginItemFormPasswordField = "uno/testid/popup/login-item/form/password-field",
  }

  export interface TestTarget {
    "data-testid"?: TestID | string;
  }

  /**
   * Creates a "data-testid" attribute that can be passed to a DOM element or
   * React compoenent with props extending from the `E2E.TestTarget` interface.
   */
  export function TestTarget(id?: TestID): TestTarget | undefined;
  export function TestTarget(id?: string): TestTarget | undefined;
  export function TestTarget(props?: TestTarget): TestTarget | undefined;
  export function TestTarget(arg?: TestTarget | TestID | string): TestTarget | undefined {
    if (process.env.ENV_NAME === "e2e") {
      return {
        "data-testid": typeof arg === "string" ? arg : arg?.["data-testid"],
      };
    }
  }

  /**
   * Log something in the extension's client-side code that will print to the
   * E2E runtime's console output.
   */
  export function log(message?: any, ...optionalParams: any[]) {
    if (process.env.ENV_NAME === "e2e") {
      console.debug("[E2E.log]", message, ...optionalParams);
    }
  }

  /**
   * Upon receiving the `InitializeTestUser` event...
   * ...bootstrap an ephemeral test user.
   *
   * NOTE: this handler will respond only once per page.
   */
  export function handleInitializeTestUser(orchestrator: UnoOrchestrator) {
    if (process.env.ENV_NAME === "e2e") {
      createTestEventAPIHandler({
        dispatchEvent: TestEvent.Type.InitializeTestUser,
        successEvent: TestEvent.Type.InitializeTestUserSuccess,
        errorEvent: TestEvent.Type.InitializeTestUserError,
        async handle() {
          const email = `test+${uuid()}@uno.app`;
          const { CreateVault } = await import("@/v2/actions/vault/create-vault.action");
          await orchestrator.useAction(CreateVault)({ email });
          return { email };
        },
      });
    }
  }

  /**
   * Upon receiving the `InjectTestVaultData` event...
   * ...inject the test vault data provided in the event.
   */
  export function handleInjectTestVaultData(orchestrator: UnoOrchestrator) {
    if (process.env.ENV_NAME === "e2e") {
      createTestEventAPIHandler({
        dispatchEvent: TestEvent.Type.InjectTestVaultData,
        successEvent: TestEvent.Type.InjectTestVaultDataSuccess,
        errorEvent: TestEvent.Type.InjectTestVaultDataError,
        async handle(detail) {
          const { PutRawVault } = await import("@/v2/actions/vault/put-raw-vault.action");
          const { GetRawVault } = await import("@/v2/actions/vault/get-raw-vault.action");
          await orchestrator.useAction(PutRawVault)({ vault: detail.vault });
          const injectedVault = await orchestrator.useAction(GetRawVault)();
          return { vault: injectedVault };
        },
      });
    }
  }

  /**
   * Upon receiving the `GetTestVaultData` event...
   * ...retrieve the latest state of vault data and resolve.
   */
  export function handleGetTestVaultData(orchestrator: UnoOrchestrator) {
    if (process.env.ENV_NAME === "e2e") {
      createTestEventAPIHandler({
        dispatchEvent: TestEvent.Type.GetTestVaultData,
        successEvent: TestEvent.Type.GetTestVaultDataSuccess,
        errorEvent: TestEvent.Type.GetTestVaultDataError,
        async handle() {
          const { GetRawVault } = await import("@/v2/actions/vault/get-raw-vault.action");
          const vault = await orchestrator.useAction(GetRawVault)();
          return { vault };
        },
      });
    }
  }

  /**
   * Upon receiving the `GetTestVaultID` event...
   * ...retrieve the latest vault ID and resolve.
   */
  export function handleGetTestVaultID(orchestrator: UnoOrchestrator) {
    if (process.env.ENV_NAME === "e2e") {
      createTestEventAPIHandler({
        dispatchEvent: TestEvent.Type.GetTestVaultID,
        successEvent: TestEvent.Type.GetTestVaultIDSuccess,
        errorEvent: TestEvent.Type.GetTestVaultIDError,
        async handle() {
          const { GetVaultID } = await import("@/v2/actions/vault/get-vault-id.action");
          const id = await orchestrator.useAction(GetVaultID)();
          return { id };
        },
      });
    }
  }

  /**
   * Dispatch the `OrchestratorInitialized` event to let our E2E tests
   * know the orchestrator for this page has completed its initialization.
   */
  export function dispatchOrchestratorInitialized() {
    if (process.env.ENV_NAME === "e2e") {
      window.dispatchEvent(createMetaTestEvent(TestEvent.Type.OrchestratorInitialized));
    }
  }
}

/**
 * Instantiates a wrapper event for use in communicating from the extension's
 * client-side code to the E2E runtime code.
 *
 * Note: we try to minimize the number of test-environment-specific messages
 * that need to be shared between runtimes. Though it's not a great practice,
 * but we have some abnormal use-cases that cannot be reliably tested without
 * some test-specific functionality.
 */
function createMetaTestEvent<Ev extends TestEvent.Type>(
  ...args: ExtractTestEvent<Ev> extends CustomEvent<infer R> ? [event: Ev, detail: R] : [event: Ev]
): WindowEventMap["__uno_e2e_meta_event__"] {
  const [event, detail] = args;
  return new CustomEvent("__uno_e2e_meta_event__", {
    detail: { type: event, detail },
  });
}

/**
 * Creates a handler for incoming test events dispatched using the
 * `createTestEventAPI` fixture.
 */
function createTestEventAPIHandler<
  DispatchEv extends TestEvent.Type,
  SuccessEv extends TestEvent.Type,
  ErrorEv extends TestEvent.Type,
>(options: {
  dispatchEvent: DispatchEv;
  successEvent: SuccessEv;
  errorEvent: ErrorEv;
  handle: (
    ...args: ExtractTestEvent<DispatchEv> extends CustomEvent<infer R> ? (R extends void ? [] : [detail: R]) : []
  ) => Promise<ExtractTestEventData<SuccessEv>>;
}) {
  if (process.env.ENV_NAME === "e2e") {
    window.addEventListener(options.dispatchEvent, async (e) => {
      const { _requestID, ...detail } = (e.detail as any) ?? ({} as any);
      try {
        const result = await (options.handle as any)(detail);
        window.dispatchEvent(
          (createMetaTestEvent as any)(options.successEvent, result ? { ...result, _requestID } : { _requestID }),
        );
      } catch (error: any) {
        window.dispatchEvent((createMetaTestEvent as any)(options.errorEvent, { error: serializeError(error) }));
      }
    });
  }
}
