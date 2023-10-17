import type {
  Fixtures,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from "@playwright/test";

export type TestFixtureExtension<
  Extensions extends Record<string, any>,
  Dependencies extends Record<string, any> = {},
> = Fixtures<
  Extensions,
  {},
  Dependencies & PlaywrightTestArgs & PlaywrightTestOptions,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>;

export interface TestContext {
  testUsers: Array<{
    email?: string;
  }>;
}

export namespace TestEvent {
  export enum Type {
    /**
     * Dispatched by the page when a content-zoned `UnoOrchestrator` has
     * completed initialization.
     */
    OrchestratorInitialized = "uno/test/orchestratorInitialized",

    /**
     * Emits an event to the page requesting that a test user with an empty vault
     * be created.
     *
     * The page acknowledges user is ready when `InitializeTestUserSuccess` is
     * dispatched in response.
     *
     * In the event of an error, `InitializeTestUserError` is dispatched from the
     * page instead.
     */
    InitializeTestUser = "uno/test/InitializeTestUser",
    InitializeTestUserSuccess = "uno/test/InitializeTestUser/Success",
    InitializeTestUserError = "uno/test/InitializeTestUser/Error",

    /**
     * Emits an event to the page requesting that some testing data is saved into
     * a test user's vault.
     *
     * The page acknowledges the testing data is ready when `InjectTestVaultDataSuccess`
     * is dispatched in response.
     *
     * In the event of an error, `InjectTestVaultDataError` is dispatched from the
     * page instead.
     */
    InjectTestVaultData = "uno/test/InjectTestVaultData",
    InjectTestVaultDataSuccess = "uno/test/InjectTestVaultData/Success",
    InjectTestVaultDataError = "uno/test/InjectTestVaultData/Error",

    /**
     * Emits an event to the page requesting the current state of the user's
     * vault.
     *
     * The page acknowledges with the resolved vault data when
     * `GetTestVaultDataSuccess` is dispatched in response.
     *
     * In the event of an error, `GetTestVaultDataError` is dispatched from the
     * page instead.
     */
    GetTestVaultData = "uno/test/GetTestVaultData",
    GetTestVaultDataSuccess = "uno/test/GetTestVaultData/Success",
    GetTestVaultDataError = "uno/test/GetTestVaultData/Error",

    /**
     * Emits an event to the page requesting the current state of the user's
     * vault.
     *
     * The page acknowledges with the resolved vault data when
     * `GetTestVaultIDSuccess` is dispatched in response.
     *
     * In the event of an error, `GetTestVaultIDError` is dispatched from the
     * page instead.
     */
    GetTestVaultID = "uno/test/GetTestVaultID",
    GetTestVaultIDSuccess = "uno/test/GetTestVaultID/Success",
    GetTestVaultIDError = "uno/test/GetTestVaultID/Error",
  }

  export interface WithoutArgs<Ev extends Type> extends CustomEvent<void> {
    type: Ev;
  }

  export interface WithArgs<Ev extends Type, T = any> extends CustomEvent<T> {
    type: Ev;
  }

  export interface WithError<Ev extends Type> extends CustomEvent<{ error: any }> {
    type: Ev;
  }
}

export type TestEvent<Ev extends TestEvent.Type, T extends Record<string, any> | void = void> = T extends void
  ? TestEvent.WithoutArgs<Ev>
  : T extends Error
  ? TestEvent.WithError<Ev>
  : TestEvent.WithArgs<Ev, T>;

export type ExtractTestEvent<Ev extends TestEvent.Type | TestEvent.Type[]> = Ev extends TestEvent.Type
  ? Extract<TestEvents, TestEvent<Ev, any>>
  : Ev extends TestEvent.Type[]
  ? Extract<TestEvents, TestEvent<Ev[number], any>>
  : never;

export type ExtractTestEventData<Ev extends TestEvent.Type | TestEvent.Type[]> =
  ExtractTestEvent<Ev> extends CustomEvent<infer R> ? (R extends void ? Record<string, never> : R) : void;

export type TestEvents =
  // Event dispatched by a content-zoned `UnoOrchestrator` instance upon
  // successful initialization.
  | TestEvent<TestEvent.Type.OrchestratorInitialized>

  // Events for handling the initialization of test users.
  | TestEvent<TestEvent.Type.InitializeTestUser>
  | TestEvent<TestEvent.Type.InitializeTestUserSuccess, { email: string }>
  | TestEvent<TestEvent.Type.InitializeTestUserError, Error>

  // Events for handling the initialization of test vault data.
  | TestEvent<TestEvent.Type.InjectTestVaultData, { vault: any }>
  | TestEvent<TestEvent.Type.InjectTestVaultDataSuccess, { vault: any }>
  | TestEvent<TestEvent.Type.InjectTestVaultDataError, Error>

  // Events for getting the current API state of a test user's vault data.
  | TestEvent<TestEvent.Type.GetTestVaultData>
  | TestEvent<TestEvent.Type.GetTestVaultDataSuccess, { vault: any }>
  | TestEvent<TestEvent.Type.GetTestVaultDataError, Error>

  // Events for getting the current ID of a test user's vault data.
  | TestEvent<TestEvent.Type.GetTestVaultID>
  | TestEvent<TestEvent.Type.GetTestVaultIDSuccess, { id: string }>
  | TestEvent<TestEvent.Type.GetTestVaultIDError, Error>;

/**
 * Here, we extend global event listener APIs
 * to accept our strongly-typed test events.
 */
declare global {
  function addEventListener<Ev extends TestEvent.Type>(
    eventName: Ev,
    listener: (e: Extract<TestEvents, TestEvent<Ev, any>>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  function removeEventListener<Ev extends TestEvent.Type>(
    eventName: Ev,
    listener: (e: Extract<TestEvents, TestEvent<Ev, any>>) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  type TestEventMap = {
    [Ev in TestEvent.Type]: ExtractTestEvent<Ev> extends CustomEvent<infer R> ? CustomEvent<R> : Event;
  };

  interface WindowEventMap extends TestEventMap {
    __uno_e2e_meta_event__: CustomEvent<{
      type: TestEvent.Type;
      detail: any;
    }>;
  }
}
