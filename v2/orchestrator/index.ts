import Semaphore from "semaphore-async-await";
import { v4 as uuidV4 } from "uuid";

import { E2E } from "@/e2e";
import type { VaultService } from "@/v1/service/vault_service/service";

import { UnoError, UnoErrorCode } from "./errors";
import { hotkeys } from "./hotkeys";
import { createVaultSeed } from "../crypto/random";
import { UnoStore } from "../store";
import { isDemoHost } from "../ui/hooks/use-demo-host";
import type { RouteConfig } from "../ui/router";
import { Deferred } from "../utils/async";
import { noThrow } from "../utils/control-flow";

export class UnoOrchestrator<Z extends Zone = Zone> {
  private static _instance: UnoOrchestrator;
  private static _actions: Map<string, UnoOrchestrator.AnyAction> = new Map();
  private static _globalHotkeys: Set<UnoOrchestrator.GlobalHotkeyDefinition> = new Set();
  private static _alarms: Map<string, UnoOrchestrator.AlarmDefinition> = new Map();
  private static _alarmsPrefix = "uno::alarm";
  private static _layerRoutes: Set<() => RouteConfig> = new Set();
  private static _pageRoutes: Set<() => RouteConfig> = new Set();
  private static _eventListeners = new Map<string, Set<UnoOrchestrator.Events.Listener>>();
  private static _storageLock = new Semaphore(1);
  private static _concurrencyLocks = new Map<string, Semaphore>();

  private _initialization: Deferred<void>;
  private _runtimeInfo: Z extends Zone.Content ? UnoOrchestrator.RuntimeInfo : null = null as any;

  public readonly zone: Z;
  public readonly version: UnoOrchestrator.DebugInfo.ExtensionVersion;
  public readonly initialized: Promise<void>;

  // --- Constructor & initialization --------------------------------------- //
  // An `UnoOrchestrator` instance must be "initialized" before usage. Actions
  // and listeners are not guaranteed to be listening for events until the
  // initialization promise is resolved.

  constructor(_zone: Z) {
    if (UnoOrchestrator._instance) {
      throw new UnoError(UnoError.Code.OrchestratorAlreadyInstantiated);
    } else {
      UnoOrchestrator._instance = this;
      this._initialization = new Deferred();
      this.initialized = this._initialization.promise;
    }

    // Initialize this orchestrator with a reference to its execution zone.
    // We use this to verify runtime messages shared between execution zones.
    this.zone = _zone;

    // Configure debug info for this extension build.
    const rawVersion = process.env.EXT_VERSION;
    const [major, _minor, release, preRelease] = rawVersion.split(".");
    this.version = {
      raw: process.env.EXT_VERSION,
      major: Number(major),
      release: Number(release),
      preRelease: preRelease ? Number(preRelease) : null,
    };

    // Initialize message-sharing between orchestrator zones
    // (supporting a lightweight messaging protocol between execution zones)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const message = this.deserializeMessage(request);

      if (message.kind === "v2/EVENTS/EXECUTE") {
        this.dispatchEvent(message.payload.event);
        return;
      }

      if (message.target !== this.zone || !message.kind.startsWith("v2")) {
        // This message isn't meant for us.
        return;
      }

      this.handleMessage({
        message,
        sender,

        resolve: <Kind extends UnoOrchestrator.Protocol.MessageKind>(
          kind: Kind,
          payload: UnoOrchestrator.Protocol.MessagePayload<Kind>,
        ) => {
          sendResponse(
            this.serializeMessage({
              kind,
              triggeredFrom: message.target,
              target: message.triggeredFrom,
              payload: payload as any, // TypeScript will protect us here
            }),
          );
        },

        reject: (err: any) => {
          sendResponse(
            this.serializeMessage({
              kind: "v2/ERROR",
              triggeredFrom: message.target,
              target: message.triggeredFrom,
              payload: {
                message: err instanceof Error ? err.message : err,
                code: err instanceof UnoError ? err.code : undefined,
              },
            }),
          );
        },
      });

      // Inform the browser that we will make a delayed `sendResponse`
      return true;
    });

    // Set-up `onAlarm` listener
    if (this.zone === Zone.Background) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name.startsWith(UnoOrchestrator._alarmsPrefix)) {
          UnoOrchestrator._alarms.get(alarm.name)?.onActivate(this as UnoOrchestrator<Zone.Background>);
        }
      });
    }
  }

  /**
   * Performs asynchronous initializations for this `UnoOrchestrator` instance.
   */
  public async initialize() {
    // Inject the current Orchestrator instance into the store & trigger initial
    // hydration.
    await UnoStore.initialize(this);

    // Hydrate the current browser tab ID if we're in a "content scripts" zone.
    if (this.zone === Zone.Content && !this._runtimeInfo) {
      const runtimeInfo = await this.sendMessage("v2/GET_RUNTIME_INFO", {
        target: Zone.Background,
      }).then((response) => {
        switch (response.kind) {
          case "v2/GET_RUNTIME_INFO/RESULT":
            return response.payload;
          default:
            throw new UnoError(UnoError.Code.ActionError);
        }
      });
      (this as UnoOrchestrator<Zone.Content>)._runtimeInfo = runtimeInfo;
    } else {
      (this as UnoOrchestrator<Zone.Background | Zone.Popup>)._runtimeInfo = null;
    }

    if (this.zone === Zone.Content) {
      // Collect registered in-page layer routes.
      // @ts-expect-error - We know this glob pattern will work; ignore TypeScript's complaint...
      // eslint-disable-next-line import/no-unresolved
      await import("../actions/**/*.layer.tsx");

      // Collect registered top-level page routes.
      // @ts-expect-error - We know this glob pattern will work; ignore TypeScript's complaint...
      // eslint-disable-next-line import/no-unresolved
      await import("../actions/**/*.page.tsx");
    }

    if (this.zone === Zone.Content) {
      // Collect registered global hotkeys.
      // @ts-expect-error - We know this glob pattern will work; ignore TypeScript's complaint...
      // eslint-disable-next-line import/no-unresolved
      await import("../actions/**/*.hotkey.ts");

      UnoOrchestrator._globalHotkeys.forEach((hotkeyDefinition) => {
        const hotkeysListener = (e: KeyboardEvent) => {
          e.preventDefault();
          hotkeyDefinition.onActivate(this as UnoOrchestrator<Zone.Content>).catch(() => {
            // ignore errors from actions dispatched by hotkeys.
            // TODO: log these to console/sentry?
          });
        };

        hotkeys(hotkeyDefinition.pattern, { scope: "all", splitKey: hotkeyDefinition.splitKey }, hotkeysListener);
      });
    }

    if (this.zone === Zone.Background) {
      // Collect registered alarms.
      // @ts-expect-error - We know this glob pattern will work; ignore TypeScript's complaint...
      // eslint-disable-next-line import/no-unresolved
      await import("../actions/**/*.alarm.ts");

      // Clear out existing alarms registered with this orchestrator. This
      // ensures that when we update the app, any alarms removed from our
      // code-base are safely removed from our `onAlarm` listener.
      await new Promise<void>((resolve) => {
        chrome.alarms.getAll((alarms) => {
          const prefixedAlarms = alarms.filter((alarm) => {
            return alarm.name.startsWith(UnoOrchestrator._alarmsPrefix);
          });

          Promise.all(
            prefixedAlarms.map(async (alarm) => {
              return chrome.alarms.clear(alarm.name);
            }),
          ).then(() => {
            resolve();
          });
        });
      });

      await Promise.all(
        [...UnoOrchestrator._alarms.values()].map(async (alarm) => {
          const { when, delayInMinutes, periodInMinutes } = alarm;

          // Execute `onActivate` immediately for alarms defined with `when: "now"`.
          // This works around a limitation imposed by the browser which causes
          // alarms to wait at minimum 1 minute before initial execution.
          if (when === "now") {
            this.initialized.then(() => alarm?.onActivate(this as UnoOrchestrator<Zone.Background>));
          }

          // Create the alarm; `onActivate` will execute in the `onAlarm`
          // listener we registered in this orchestrator's constructor.
          if ((typeof when === "number" && when != null) || delayInMinutes != null || periodInMinutes != null) {
            await chrome.alarms.create(alarm.name, {
              when: when === "now" ? undefined : when,
              delayInMinutes,
              periodInMinutes,
            });
          }
        }),
      );
    }

    // Initialize event channels supporting E2E tests...
    // NOTE: Zones with access to DOM only!
    if (this.zone !== Zone.Background) {
      E2E.handleInitializeTestUser(this);
      E2E.handleInjectTestVaultData(this);
      E2E.handleGetTestVaultData(this);
      E2E.handleGetTestVaultID(this);
      E2E.dispatchOrchestratorInitialized();
    }

    // Resolve the initialization promise.
    this._initialization.resolve();
  }

  /**
   * @returns the `RuntimeInfo` for this orchestrator (if applicable to the
   * configured zone).
   *
   * NOTE: Accessing this field before initialization is complete will result in
   * an error.
   */
  public get runtimeInfo(): Z extends Zone.Content ? UnoOrchestrator.RuntimeInfo : null {
    if (this._initialization.state === "pending") {
      throw new UnoError(UnoError.Code.OrchestratorNotInitialized);
    } else {
      return this._runtimeInfo;
    }
  }

  // --- Static utilities (public) ------------------------------------------ //
  // Methods supporting the registration of global hotkeys, routes, etc.
  // (essentially this covers in-memory global state stored on the
  //  `UnoOrchestrator` constructor).

  /**
   * Registers a hotkey pattern globally.
   */
  public static registerGlobalHotkey(hotkey: UnoOrchestrator.GlobalHotkeyDefinition) {
    UnoOrchestrator._globalHotkeys.add(hotkey);
  }

  /**
   * Registers an alarm globally to run some logic periodically.
   */
  public static registerAlarm(alarm: UnoOrchestrator.AlarmDefinition) {
    const prefixedName = `${UnoOrchestrator._alarmsPrefix}::${alarm.name}`;
    UnoOrchestrator._alarms.set(prefixedName, {
      ...alarm,
      name: prefixedName,
    });
  }

  /**
   * Registers an in-page "layer" route.
   */
  public static registerLayerRoute(routeFactory: () => RouteConfig): () => RouteConfig {
    UnoOrchestrator._layerRoutes.add(routeFactory);
    return routeFactory;
  }

  /**
   * Introspect layers registered with this orchestrator.
   */
  public static getRegisteredLayerRoutes(): Array<RouteConfig> {
    return Array.from(UnoOrchestrator._layerRoutes).map((routeFactory) => routeFactory());
  }

  /**
   * Registers a top-level page route (rendered as a browser tab or window).
   */
  public static registerPageRoute(routeFactory: () => RouteConfig): () => RouteConfig {
    UnoOrchestrator._pageRoutes.add(routeFactory);
    return routeFactory;
  }

  /**
   * Introspect page routes registered with this orchestrator.
   */
  public static getRegisteredPageRoutes(): Array<RouteConfig> {
    return Array.from(UnoOrchestrator._pageRoutes).map((routeFactory) => routeFactory());
  }

  // --- Static utilities (internal) ---------------------------------------- //
  // Private methods supporting various internal functionality of the
  // `UnoOrchestrator` itself.

  private static _targetedTabID = Symbol();

  /**
   * Creates a clone of the given `orchestrator` instance, decorated with a
   * browser tab ID to which follow-up "content"-zoned actions should
   * be dispatched.
   */
  private static async cloneWithTargetedTabID<O extends UnoOrchestrator>(
    orchestrator: O,
    targetedTabID?: number,
  ): Promise<O> {
    return new Promise((resolve) => {
      if (orchestrator.zone === Zone.Content) {
        resolve(
          Object.assign(Object.create(Object.getPrototypeOf(orchestrator)), orchestrator, {
            [UnoOrchestrator._targetedTabID]: orchestrator.runtimeInfo,
          }),
        );
      } else if (targetedTabID != null) {
        resolve(
          Object.assign(Object.create(Object.getPrototypeOf(orchestrator)), orchestrator, {
            [UnoOrchestrator._targetedTabID]: targetedTabID,
          }),
        );
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(
            Object.assign(Object.create(Object.getPrototypeOf(orchestrator)), orchestrator, {
              [UnoOrchestrator._targetedTabID]: tabs[0]?.id,
            }),
          );
        });
      }
    });
  }

  /**
   * Gets the tab ID decorated onto this orchestrator instance, if one is set.
   */
  private static getTargetedTabID(orchestrator: UnoOrchestrator) {
    return (orchestrator as any)[UnoOrchestrator._targetedTabID];
  }

  // --- Actions ------------------------------------------------------------ //
  // Methods supporting the dispatch and execution of "actions"
  // (small chunks of composable business logic found throughout the code-base).

  /**
   * Registers an orchestrator "action", making it available to the
   * `useAction` method.
   */
  public static registerAction<Z extends DispatchableZone, Executor extends UnoOrchestrator.Action.Executor>(
    action: UnoOrchestrator.Action<Z, Executor>,
  ): UnoOrchestrator.Action<Z, Executor> {
    UnoOrchestrator._actions.set(action.id, action as UnoOrchestrator.AnyAction);
    return action;
  }

  /**
   * Introspect actions registered with this orchestrator. You can retrieve a
   * registered action's dispatcher by it's action ID.
   */
  public static getRegisteredAction<A extends UnoOrchestrator.AnyAction>(id: string): A {
    return UnoOrchestrator._actions.get(id) as any;
  }

  /**
   * Creates a function to dispatch an orchestrator "action" performing some
   * business logic, state mutation, etc.
   */
  public useAction<A extends UnoOrchestrator.Action<any, any>>(action: A): UnoOrchestrator.Action.ExtractExecutor<A> {
    return (async (input: any) => {
      await this.initialized;

      const response = await this.sendMessage("v2/EXECUTE_ACTION", {
        payload: { id: action.id, input },
        target: action.zone,
      });

      switch (response.kind) {
        case "v2/EXECUTE_ACTION/RESULT":
          return response.payload.output;
        default:
          throw new UnoError(UnoError.Code.ActionError);
      }
    }) as UnoOrchestrator.Action.ExtractExecutor<A>;
  }

  /**
   * Executes a runtime action's workload. This is called from the zone
   * receiving an action via `useAction`.
   * @internal
   */
  private async executeAction(
    action: UnoOrchestrator.AnyAction,
    input: any = {},
    sender?: chrome.runtime.MessageSender,
  ) {
    await this.initialized;

    let didAcquireLock = false;
    try {
      if (action.concurrency) {
        await this.sendMessage("v2/CONCURRENCY/CREATE_LOCK", {
          payload: {
            key: typeof action.concurrency === "number" ? action.id : action.concurrency,
            permits: typeof action.concurrency === "number" ? action.concurrency : 1,
          },
          target: Zone.Background,
        });

        const lockRes = await this.sendMessage("v2/CONCURRENCY/ACQUIRE_LOCK", {
          payload: { key: typeof action.concurrency === "number" ? action.id : action.concurrency },
          target: Zone.Background,
        });

        if (lockRes.kind === "v2/CONCURRENCY/ACQUIRE_LOCK/DONE") {
          didAcquireLock = lockRes.payload;
        }
      }

      console.debug(`[action] [${action.id}] input:`, input);

      // Generate context data for this action.
      const actionCtx = await this.getActionContext(this.zone, sender);

      const result = await Promise.resolve(
        action.execute.call(
          action.binding
            ? Object.assign(Object.create(Object.getPrototypeOf(action.binding)), action.binding, {
                context: actionCtx,
              })
            : { context: actionCtx },
          input,
        ),
      );

      return result;
    } finally {
      if (action.concurrency && didAcquireLock) {
        await this.sendMessage("v2/CONCURRENCY/RELEASE_LOCK", {
          payload: { key: typeof action.concurrency === "number" ? action.id : action.concurrency },
          target: Zone.Background,
        });
      }
    }
  }

  /**
   * Creates a context object for an action
   * based on the assigned execution zone.
   * @internal
   */
  private async getActionContext<Z extends Zone>(
    zone: Z,
    sender?: chrome.runtime.MessageSender,
  ): Promise<UnoOrchestrator.Action.Context<Z>> {
    const baseContext: UnoOrchestrator.Action.Context.Base<DispatchableZone> = {
      orchestrator: await UnoOrchestrator.cloneWithTargetedTabID<UnoOrchestrator<DispatchableZone>>(
        this as UnoOrchestrator<DispatchableZone>,
        sender?.tab?.id,
      ),
      store: {
        getState: UnoStore.getState,
        setState: UnoStore.setState,
        resetPersistence: UnoStore.resetPersistence,
      },
    };

    switch (zone) {
      case Zone.Content: {
        return {
          ...(baseContext as UnoOrchestrator.Action.Context.Base<Zone.Content>),
          isDemoHost: isDemoHost(),
        } satisfies UnoOrchestrator.Action.Context<Zone.Content> as UnoOrchestrator.Action.Context<Z>;
      }

      case Zone.Background:
      default: {
        const { newDefaultVaultService } = await import("@/v1/service/vault_service/service");
        const { clientIdFromStorage, realSeedFromStorage } = await import("@/v1/state");
        const { maxSch } = await import("@/v1/background");
        const { default: Logger } = await import("@/v1/logger");

        const logger = new Logger(process.env.ENV_NAME);

        const foundSeed: string | undefined | null = await realSeedFromStorage();
        const foundClientID: string | undefined | null = await clientIdFromStorage();
        const needsOnboard = foundSeed == null || foundClientID == null;

        const seed = needsOnboard ? createVaultSeed() : foundSeed;
        const clientID = needsOnboard ? uuidV4() : foundClientID;

        const vaultService = newDefaultVaultService(process.env.API_SERVER, seed, clientID, maxSch, logger);

        return {
          ...(baseContext as UnoOrchestrator.Action.Context.Base<Zone.Background>),
          vaultService,
          vaultInfo: { seed, clientID, needsOnboard },
        } satisfies UnoOrchestrator.Action.Context<Zone.Background> as UnoOrchestrator.Action.Context<Z>;
      }
    }
  }

  // --- Events ------------------------------------------------------------- //
  // Sometimes we need to notify all zones of some event having occurred. Below
  // are methods to support a rudimentary event emitter that works between
  // execution contexts. To keep things simple, events are static and cannot
  // receive arguments.

  public events = {
    /**
     * Attach a `listener` function for the given `event`.
     * @returns a callback to remove the listener.
     */
    on: (event: string, listener: UnoOrchestrator.Events.Listener): UnoOrchestrator.Events.RemoveListener => {
      if (!UnoOrchestrator._eventListeners.has(event)) {
        const listeners = new Set([listener]);
        UnoOrchestrator._eventListeners.set(event, listeners);
      } else {
        UnoOrchestrator._eventListeners.get(event)!.add(listener);
      }
      return () => {
        UnoOrchestrator._eventListeners.get(event)?.delete(listener);
      };
    },

    /**
     * Attach a `listener` function for the given `event`, to be executed only
     * once, then removed automatically.
     * @returns a callback to remove the listener immediately.
     */
    once: (event: string, listener: UnoOrchestrator.Events.Listener): UnoOrchestrator.Events.RemoveListener => {
      const remove = this.events.on(event, () => {
        Promise.resolve(listener()).then(remove);
      });
      return remove;
    },

    /**
     * Emits the given `event` to all zones with an initialized orchestrator.
     */
    emit: (event: string) => {
      noThrow(async () => {
        await this.sendMessage("v2/EVENTS/DISPATCH", {
          payload: { event },
          target: Zone.Background,
        });
      });
    },
  };

  /**
   * Called internally by the orchestrator to execute listeners when the given
   * `event` is received.
   */
  private dispatchEvent(event: string) {
    const listeners = UnoOrchestrator._eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        noThrow(async () => listener());
      });
    }
  }

  // --- RPC ---------------------------------------------------------------- //
  // Methods supporting the sending & receiving of messages shared between
  // execution contexts available to the browser extension.

  /**
   * Send a protocol message between execution zones
   * (background/popup/content scripts).
   */
  public sendMessage<Kind extends UnoOrchestrator.Protocol.MessageKind>(
    kind: Kind,
    details: UnoOrchestrator.Protocol.MessagePayload<Kind> extends Record<string, never>
      ? {
          target: Zone;
        }
      : {
          payload: UnoOrchestrator.Protocol.MessagePayload<Kind>;
          target: Zone;
        },
  ): Promise<UnoOrchestrator.Protocol> {
    return new Promise((resolve, reject) => {
      const message: UnoOrchestrator.Protocol = {
        kind,
        triggeredFrom: this.zone,
        target: details.target,
        payload: (details as any).payload ?? {},
      };
      const messageJSON = this.serializeMessage(message);

      const handleResponse = (response: string | UnoOrchestrator.Protocol.AnyMessage) => {
        const message = typeof response === "string" ? this.deserializeMessage(response) : response;

        if (!message?.kind) {
          return;
        }

        switch (message.kind) {
          case "v2/ERROR": {
            reject(message.payload.code ? new UnoError(message.payload.code) : new Error(message.payload.message));
            break;
          }

          default: {
            resolve(message);
          }
        }
      };

      // Emit this message to its own zone.
      if (details.target === this.zone) {
        return this.handleMessage({
          message,

          resolve: <Kind extends UnoOrchestrator.Protocol.MessageKind>(
            kind: Kind,
            payload: UnoOrchestrator.Protocol.MessagePayload<Kind>,
          ) => {
            handleResponse({
              kind,
              triggeredFrom: details.target,
              target: this.zone,
              payload: payload as any, // TypeScript will protect us here
            });
          },

          reject: (err: any) => {
            handleResponse({
              kind: "v2/ERROR",
              triggeredFrom: details.target,
              target: this.zone,
              payload: {
                message: err instanceof Error ? err.message : err,
                code: err instanceof UnoError ? err.code : undefined,
              },
            });
          },
        });
      }

      // Emit this message to a separate zone based on the "source" -> "target"
      if (details.target === Zone.Content && (this.zone === Zone.Background || this.zone === Zone.Popup)) {
        // "background|popup" -> "content"
        const targetedTabID = UnoOrchestrator.getTargetedTabID(this);
        if (targetedTabID) {
          chrome.tabs.sendMessage(targetedTabID, messageJSON, handleResponse);
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, messageJSON, handleResponse);
            }
          });
        }
      } else {
        // "content" -> "background|popup"
        // "background" -> "popup"
        // "popup" -> "background"
        chrome.runtime.sendMessage(messageJSON, handleResponse);
      }
    });
  }

  /**
   * Handles incoming runtime/protocol messages.
   * @internal
   */
  private async handleMessage(options: {
    message: UnoOrchestrator.Protocol;
    sender?: chrome.runtime.MessageSender;
    resolve: <Kind extends UnoOrchestrator.Protocol.MessageKind>(
      kind: Kind,
      payload: UnoOrchestrator.Protocol.MessagePayload<Kind>,
    ) => void;
    reject: (err: any) => void;
  }) {
    const { message, sender, resolve, reject } = options;

    switch (message.kind) {
      case "v2/EXECUTE_ACTION": {
        // Collect registered actions and assign keyboard shortcuts, if present on the action config.
        // @ts-expect-error - We know this glob pattern will work; ignore TypeScript's complaint...
        // eslint-disable-next-line import/no-unresolved
        await import("../actions/**/*.action.ts");
        const action = UnoOrchestrator._actions.get(message.payload.id);
        if (action) {
          await this.executeAction(action, message.payload.input, sender)
            .catch(reject)
            .then((output) => {
              resolve("v2/EXECUTE_ACTION/RESULT", { output });
            });
        }
        return;
      }

      case "v2/GET_RUNTIME_INFO": {
        if (sender?.tab?.id != null && sender?.frameId != null) {
          resolve("v2/GET_RUNTIME_INFO/RESULT", {
            tabID: sender.tab.id,
            frameID: sender.frameId,
          });
        } else {
          reject(new UnoError(UnoError.Code.ActionError));
        }
        return;
      }

      case "v2/STORAGE/GET": {
        await UnoOrchestrator._storageLock.acquire();
        const { key } = message.payload;
        return chrome.storage.local.get([key], (result) => {
          UnoOrchestrator._storageLock.release();
          resolve("v2/STORAGE/GET/RESULT", result[key] ?? null);
        });
      }

      case "v2/STORAGE/SET": {
        await UnoOrchestrator._storageLock.acquire();
        const { key, value } = message.payload;
        return chrome.storage.local.set({ [key]: value }, () => {
          UnoOrchestrator._storageLock.release();
          resolve("v2/STORAGE/SET/DONE", {});
        });
      }

      case "v2/STORAGE/DELETE": {
        await UnoOrchestrator._storageLock.acquire();
        const { key } = message.payload;
        return chrome.storage.local.remove(key, () => {
          UnoOrchestrator._storageLock.release();
          resolve("v2/STORAGE/SET/DONE", {});
        });
      }

      case "v2/CONCURRENCY/CREATE_LOCK": {
        if (!UnoOrchestrator._concurrencyLocks.has(message.payload.key)) {
          UnoOrchestrator._concurrencyLocks.set(message.payload.key, new Semaphore(message.payload.permits ?? 1));
        }
        resolve("v2/CONCURRENCY/CREATE_LOCK/DONE", {});
        return;
      }

      case "v2/CONCURRENCY/ACQUIRE_LOCK": {
        const didAcquireLock = await UnoOrchestrator._concurrencyLocks.get(message.payload.key)!.acquire();
        resolve("v2/CONCURRENCY/ACQUIRE_LOCK/DONE", didAcquireLock);
        return;
      }

      case "v2/CONCURRENCY/RELEASE_LOCK": {
        if (UnoOrchestrator._concurrencyLocks.has(message.payload.key)) {
          UnoOrchestrator._concurrencyLocks.get(message.payload.key)!.release();
        }
        resolve("v2/CONCURRENCY/RELEASE_LOCK/DONE", {});
        return;
      }

      case "v2/EVENTS/DISPATCH": {
        const messageJSON = JSON.stringify({
          kind: "v2/EVENTS/EXECUTE",
          payload: message.payload,
        });

        this.dispatchEvent(message.payload.event);
        chrome.runtime.sendMessage(messageJSON);
        chrome.tabs.query({}, (tabs) => {
          for (let i = 0; i < tabs.length; ++i) {
            const tabID = tabs[i].id;
            if (tabID) {
              chrome.tabs.sendMessage(tabID, messageJSON);
            }
          }
        });

        resolve("v2/EVENTS/DISPATCH/DONE", {});
        return;
      }

      default: {
        reject(new UnoError(UnoError.Code.UnknownMessageKind));
      }
    }
  }

  /**
   * Serializes a runtime/protocol message.
   * @internal
   */
  private serializeMessage<Msg extends UnoOrchestrator.Protocol>(msg: Msg): string {
    try {
      return JSON.stringify(msg);
    } catch (err) {
      throw new Error(`Error serializing message: ${msg}`);
    }
  }

  /**
   * Deserializes a runtime/protocol message.
   * @internal
   */
  private deserializeMessage(json: string): UnoOrchestrator.Protocol {
    try {
      return JSON.parse(json);
    } catch (err) {
      throw new Error(`Error deserializing message: ${json}`);
    }
  }
}

// --- Types ---------------------------------------------------------------- //

/**
 * An enumeration of "zones" where extension scripts can run.
 *
 * `Background` represents the zone for the extension's background/service
 * worker scripts.
 *
 * `Content` represents the zone for the extension's foreground/injected content
 * scripts.
 *
 * `Popup` represents the zone for the extension's browser toolbar popup
 * scripts.
 */
export enum Zone {
  Background = "background",
  Content = "content",
  Popup = "popup",
}

/**
 * All zones can dispatch actions via `useAction`, but only certain zones
 * can receive those actions. We exclude `Zone.Popup` from this type.
 */
export type DispatchableZone = Zone.Background | Zone.Content;

export namespace UnoOrchestrator {
  export namespace DebugInfo {
    export interface ExtensionVersion {
      raw: string;
      major: number;
      release: number;
      preRelease: number | null;
    }
  }

  export interface RuntimeInfo {
    tabID: number;
    frameID: number;
  }

  export interface GlobalHotkeyDefinition {
    pattern: string;
    splitKey?: string;
    onActivate: (orchestrator: UnoOrchestrator<Zone.Content>) => Promise<void>;
  }

  export interface AlarmDefinition {
    name: string;
    onActivate: (orchestrator: UnoOrchestrator<Zone.Background>) => Promise<void>;

    /**
     * Length of time in minutes after which the onAlarm event should fire.
     */
    delayInMinutes?: number | undefined;

    /**
     * If set, the onAlarm event should fire every periodInMinutes minutes after
     * the initial event specified by when or delayInMinutes. If not set, the
     * alarm will only fire once.
     */
    periodInMinutes?: number | undefined;

    /**
     * Time at which the alarm should fire, in milliseconds past the epoch (e.g.
     * Date.now() + n).
     *
     * If set to "now", the alarm will fire immediately upon registration.
     */
    when?: "now" | number | undefined;
  }

  // --- Events types ------------------------------------------------------- //

  export namespace Events {
    export interface Listener {
      (): void | Promise<void>;
    }

    export interface RemoveListener {
      (): void;
    }
  }

  // --- RPC types ---------------------------------------------------------- //

  export namespace Protocol {
    /**
     * Represents serialized data and/or RPC requests shared
     * between the extension's different execution zones.
     */
    export interface Message<Kind extends string, Payload = Record<string, never>> {
      kind: Kind;
      payload: Payload;
      triggeredFrom: Zone;
      target: Zone;
    }

    export type AnyMessage = Message<any, any>;

    /**
     * A union of valid `Message.kind` values for use
     * in communicating between execution zones.
     */
    export type MessageKind = Protocol extends Message<infer R, any> ? R : never;

    /**
     * For the given `MessageKind`, glean the payload data type for that `Message`.
     */
    export type MessagePayload<Kind extends MessageKind> = Extract<Protocol, Message<Kind, any>> extends Message<
      Kind,
      infer R
    >
      ? R
      : never;
  }

  /**
   * A union of known `Message` types supported by the `UnoOrchestrator` class.
   *
   * Generally, messages sent between execution contexts can be encapsulated as
   * actions. For cases where this is impossible or where the developer ergonomics
   * pose a challenge, we use a low-level `Message`, as represented here.
   */
  export type Protocol =
    /**
     * Messages representing the execution of actions between zones.
     */
    | Protocol.Message<"v2/EXECUTE_ACTION", { id: string; input: any }>
    | Protocol.Message<"v2/EXECUTE_ACTION/RESULT", { output: any }>

    /**
     * Retrieves the tab ID & frame ID for the message sender.
     * NOTE: This should only be dispatched from content scripts.
     */
    | Protocol.Message<"v2/GET_RUNTIME_INFO">
    | Protocol.Message<"v2/GET_RUNTIME_INFO/RESULT", RuntimeInfo>

    /**
     * Interface for reading/writing persistent, local extension storage.
     * NOTE: This should only be dispatched from content or popup scripts,
     * targeting background scripts.
     */
    | Protocol.Message<"v2/STORAGE/GET", { key: string }>
    | Protocol.Message<"v2/STORAGE/GET/RESULT", any>
    | Protocol.Message<"v2/STORAGE/SET", { key: string; value: string }>
    | Protocol.Message<"v2/STORAGE/SET/DONE">
    | Protocol.Message<"v2/STORAGE/DELETE", { key: string | string[] }>
    | Protocol.Message<"v2/STORAGE/DELETE/DONE">

    /**
     * Interface for working with concurrency locks (via `semaphore-async-await`).
     */
    | Protocol.Message<"v2/CONCURRENCY/CREATE_LOCK", { key: string; permits: number }>
    | Protocol.Message<"v2/CONCURRENCY/CREATE_LOCK/DONE">
    | Protocol.Message<"v2/CONCURRENCY/ACQUIRE_LOCK", { key: string }>
    | Protocol.Message<"v2/CONCURRENCY/ACQUIRE_LOCK/DONE", boolean>
    | Protocol.Message<"v2/CONCURRENCY/RELEASE_LOCK", { key: string }>
    | Protocol.Message<"v2/CONCURRENCY/RELEASE_LOCK/DONE">

    /**
     * Interface for emitting/receiving arbitrary events on the orchestrator
     * instance. When `orchestrator.events.emit(...)` is called, all zone's with
     * an initialized orchestrator can act upon that event. One prominent
     * use-case for this in our application is to signal all layers to
     * cache-bust in-memory vault data.
     */
    | Protocol.Message<"v2/EVENTS/DISPATCH", { event: string }>
    | Protocol.Message<"v2/EVENTS/DISPATCH/DONE">
    | Protocol.Message<"v2/EVENTS/EXECUTE", { event: string }>
    | Protocol.Message<"v2/EVENTS/EXECUTE/DONE">

    /**
     * Message representing any error as a response to the message event.
     */
    | Protocol.Message<"v2/ERROR", { message: string; code?: UnoErrorCode }>;

  // --- Action types ------------------------------------------------------- //

  export namespace Action {
    export namespace Context {
      /**
       * Base context type injected into the `Executor` of a defined `Action`.
       */
      export interface Base<Z extends DispatchableZone> {
        orchestrator: UnoOrchestrator<Z>;
        store: {
          getState: (typeof UnoStore)["getState"];
          setState: (typeof UnoStore)["setState"];
          resetPersistence: (typeof UnoStore)["resetPersistence"];
        };
      }

      /**
       * Context type for actions executed in "background" scripts.
       */
      export interface Background extends Base<Zone.Background> {
        vaultService: VaultService;
        vaultInfo: {
          seed: string;
          clientID: string;
          needsOnboard: boolean;
        };
      }

      /**
       * Context type for actions executed in "content" scripts.
       */
      export interface Foreground extends Base<Zone.Content> {
        isDemoHost: boolean;
      }
    }

    /**
     * Glean the action context type corresponding to the given `Zone` type.
     */
    export type Context<Z extends Zone = Zone> = Z extends Zone.Background
      ? Context.Background
      : Z extends Zone.Popup
      ? never
      : Context.Foreground;

    /**
     * The base function signature representing the "workload" of an action.
     */
    export type Executor = (input: any) => Promise<any>;

    /**
     * Extracts the executor function defined on the given action.
     */
    export type ExtractExecutor<A extends AnyAction> = A extends Action<any, infer Exe> ? Exe : never;
  }

  /**
   * The shape of an `Action` representing all behavioral logic,
   * state updates, and RPC requests used throughout the extension.
   */
  export type Action<Z extends DispatchableZone, Exe extends Action.Executor> = {
    /**
     * An identifier unique to this action.
     */
    id: string;

    /**
     * The execution context where this action's `execute` function should run.
     */
    zone: Z;

    /**
     * Defines the behavior of this action.
     */
    execute: Exe;

    /**
     * Controls the maximum number of concurrent actions of this type that can
     * run simultaneously. If provided as a string, the number of simultaneous
     * permits will be set to "1" for all actions that share the same
     * concurrency namespace.
     */
    concurrency?: string | number;

    /**
     * Optionally bind a value to the "this" context of the configured `execute`
     * function.
     */
    binding?: any;
  } & ThisType<{ context: Action.Context<Z> }>;

  export type AnyAction = Action<DispatchableZone, Action.Executor>;
}
