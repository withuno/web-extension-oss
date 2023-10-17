import { useCallback, useSyncExternalStore } from "react";

export interface AsyncCache<T> {
  /**
   * Sets a value in the cache. TTL is provided as milliseconds.
   */
  set(key: string, value: T, ttl?: number): Promise<T>;

  /**
   * Retrieves a value save in the cache. If the value has since expired,
   * `undefined` is returned instead.
   */
  get(key: string): Promise<T | undefined>;

  /**
   * Removes a value from the cache.
   */
  delete(key: string): Promise<void>;

  /**
   * Clears all values under this cache's namespace.
   */
  clear(): Promise<void>;
}

export interface SyncCache<T> {
  /**
   * Sets a value in the cache. TTL is provided as milliseconds.
   */
  set(key: string, value: T, ttl?: number): T;

  /**
   * Retrieves a value save in the cache. If the value has since expired,
   * `undefined` is returned instead.
   */
  get(key: string): T | undefined;

  /**
   * Removes a value from the cache.
   */
  delete(key: string): void;

  /**
   * Clears all values under this cache's namespace.
   */
  clear(): void;
}

export namespace Cache {
  export type WrappedValue<T> = {
    expires_at: number;
    value: T;
  };

  // --- Asynchronous, persistent cache ------------------------------------- //

  export class Local<T> implements AsyncCache<T> {
    constructor(
      private readonly namespace: string,
      private readonly defaultTTL: number = 0,
    ) {}

    private getNamespacedKey(key: string) {
      return `cache::${this.namespace}::${key}`;
    }

    public async set(key: string, value: T, ttl?: number): Promise<T> {
      const wrapped_value: WrappedValue<T> = {
        expires_at: Date.now() + (ttl ?? this.defaultTTL),
        value,
      };

      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [this.getNamespacedKey(key)]: wrapped_value }, () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(value);
        });
      });
    }

    public async get(key: string): Promise<T | undefined> {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([this.getNamespacedKey(key)], (res: { [key: string]: WrappedValue<T> }) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }

          const wrappedValue = res[this.getNamespacedKey(key)];
          if (wrappedValue === undefined) {
            return resolve(undefined);
          }

          if (Date.now() > wrappedValue.expires_at) {
            return resolve(undefined);
          }

          return resolve(wrappedValue.value);
        });
      });
    }

    public async delete(key: string): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove([this.getNamespacedKey(key)], () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve();
        });
      });
    }

    public async clear(): Promise<void> {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }

          const cacheKeys = Object.keys(items).filter((key) => {
            return key.startsWith(`cache::${this.namespace}::`);
          });

          chrome.storage.local.remove(cacheKeys, () => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve();
          });
        });
      });
    }
  }

  // --- Synchronous, in-memory cache --------------------------------------- //

  export class Memory<T> implements SyncCache<T> {
    private readonly _store = new Map<string, WrappedValue<T>>();
    private readonly _reactSubscriptions = new Map<string, Set<() => void>>();

    constructor(private readonly defaultTTL: number = 0) {}

    public set(key: string, value: T, ttl?: number): T {
      const wrapped_value: WrappedValue<T> = {
        expires_at: Date.now() + (ttl ?? this.defaultTTL),
        value,
      };
      this._store.set(key, wrapped_value);
      this._updateReactSubscriptions(key);
      return value;
    }

    public get(key: string): T | undefined {
      const wrappedValue = this._store.get(key);
      if (wrappedValue === undefined) {
        return undefined;
      }
      if (Date.now() > wrappedValue.expires_at) {
        return undefined;
      }
      return wrappedValue.value;
    }

    public delete(key: string): void {
      this._store.delete(key);
      this._updateReactSubscriptions(key);
    }

    public clear(): void {
      this._store.clear();
      for (const key of this._store.keys()) {
        this._updateReactSubscriptions(key);
      }
    }

    /**
     * Emits an update to all registered React subscriptions for the given `key`.
     */
    private _updateReactSubscriptions(key: string) {
      this._reactSubscriptions.get(key)?.forEach((listener) => {
        listener();
      });
    }

    /**
     * Binds this `Memory` cache to a React hook with `useSyncExternalStore`.
     */
    public use(key: string) {
      const subscribe = useCallback(
        (listener: () => void) => {
          if (!this._reactSubscriptions.has(key)) {
            this._reactSubscriptions.set(key, new Set([listener]));
          } else {
            this._reactSubscriptions.get(key)!.add(listener);
          }
          return () => {
            this._reactSubscriptions.get(key)!.delete(listener);
          };
        },
        [key],
      );

      const getSnapshot = useCallback(() => {
        return this.get(key);
      }, [key]);

      return useSyncExternalStore(subscribe, getSnapshot);
    }
  }
}
