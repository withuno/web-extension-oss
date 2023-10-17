import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

import { initialRootState, RootState } from "./root-state";
import { UnoOrchestrator, Zone } from "../orchestrator";
import { createAtomicHandler } from "../utils/async";

const STORAGE_VERSION = 1;
const STORAGE_KEY = `uno_ext/store/v${STORAGE_VERSION}`;

const atomicStoreOperation = createAtomicHandler(1);

/**
 * Parse the given `json` string, returning `undefined` if an exception occurs.
 */
function safeJSONParse<T>(json: string): T | undefined {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export namespace UnoStore {
  let state: RootState = initialRootState;

  export type Listener = (state: RootState, prevState: RootState) => void;
  const listeners: Set<Listener> = new Set();

  /**
   * Initializes a reactive global state store for this execution context in 2 steps:
   *
   *   1. Injects an `UnoOrchestrator` instance for managing storage persistence
   *      atomically.
   *   2. Executes initial hydration.
   */
  export async function initialize(orchestrator: UnoOrchestrator) {
    initialize.injectedOrchestrator = orchestrator;

    // Hydrate initial state
    await atomicStoreOperation(async () => {
      // Cleanup outdated store versions still remaining in browser storage.
      const oldStoreVersions = [...Array(STORAGE_VERSION)].map((_, i) => `uno_ext/store/v${i}`);
      await initialize.injectedOrchestrator!.sendMessage("v2/STORAGE/DELETE", {
        payload: { key: ["__uno_ext__", ...oldStoreVersions] },
        target: Zone.Background,
      });

      const res = await initialize.injectedOrchestrator!.sendMessage("v2/STORAGE/GET", {
        payload: { key: STORAGE_KEY },
        target: Zone.Background,
      });
      if (res.kind === "v2/STORAGE/GET/RESULT" && res.payload != null) {
        const hydratedState = safeJSONParse<RootState>(res.payload);
        if (hydratedState != null) {
          // Replace initial state with values retrieved from browser storage.
          state = { ...state, ...hydratedState };
        }
      }
    });

    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === "local" && STORAGE_KEY in changes) {
        if (changes[STORAGE_KEY].newValue !== changes[STORAGE_KEY].oldValue) {
          await atomicStoreOperation(async () => {
            const newValue = safeJSONParse<RootState>(changes[STORAGE_KEY].newValue) ?? {};
            const prevState = state;
            state = { ...state, ...newValue };
            listeners.forEach((listener) => listener(state, prevState));
          });
        }
      }
    });
  }
  initialize.injectedOrchestrator = null as UnoOrchestrator | null;

  /**
   * Sets global state after waiting for any in-flight hydrations to complete.
   */
  export async function setState(reducer: RootState | Partial<RootState> | ((state: RootState) => Partial<RootState>)) {
    return atomicStoreOperation(async () => {
      const nextState = reducer instanceof Function ? reducer(state) : reducer;
      if (!Object.is(nextState, state)) {
        const previousState = state;
        state = { ...state, ...nextState } as RootState;

        await initialize.injectedOrchestrator?.sendMessage("v2/STORAGE/SET", {
          payload: { key: STORAGE_KEY, value: JSON.stringify(state) },
          target: Zone.Background,
        });

        listeners.forEach((listener) => listener(state, previousState));
      }

      return state;
    });
  }

  /**
   * Gets global state after waiting for any in-flight hydrations to complete.
   */
  export async function getState(): Promise<RootState> {
    return atomicStoreOperation(async () => state);
  }

  /**
   * Return the current representation of global state, synchronously. Used by
   * `useUnoStore` to keep UI synced with real-time state updates.
   */
  export function getSnapshot(): RootState {
    return state;
  }

  /**
   * Subscribe to state mutations like an event.
   */
  export function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /**
   * Immediately clears the persistent global state layer.
   */
  export async function resetPersistence() {
    await atomicStoreOperation(async () => {
      await initialize.injectedOrchestrator?.sendMessage("v2/STORAGE/DELETE", {
        payload: { key: STORAGE_KEY },
        target: Zone.Background,
      });
    });
  }
}

/**
 * Use global state in React.
 */
export function useUnoStore(): RootState;

/**
 * Select a slice of global state for use in React.
 *
 * @param selector - a function that reduces global state to a partial slice.
 * @param equals - an equality function which decides how the state is memoized
 * in the React lifecycle. Strict equality checks are used by default.
 */
export function useUnoStore<U>(selector: (state: RootState) => U, equals?: (a: U, b: U) => boolean): U;

export function useUnoStore(
  selector: (state: RootState) => any = (state) => state,
  equals: (a: any, b: any) => boolean = Object.is,
): any {
  return useSyncExternalStoreWithSelector(
    UnoStore.subscribe,
    UnoStore.getSnapshot,
    UnoStore.getSnapshot,
    selector,
    equals,
  );
}

export type { RootState };
