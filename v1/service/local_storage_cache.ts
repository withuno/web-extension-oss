import { WrappedValue, isExpired } from "./cache";

export default class LocalStorageCache<T> {
  async setValue(key: string, value: T, cache_seconds: number): Promise<T> {
    const wrapped_value: WrappedValue<T> = {
      expires_at: cache_seconds == -1 ? -1 : Date.now() / 1000 + cache_seconds,
      value,
    };

    return new Promise(function (resolve, reject) {
      chrome.storage.local.set({ [key]: wrapped_value }, function () {
        if (chrome.runtime.lastError) {
          // XXX return an UnoError
          return reject(chrome.runtime.lastError);
        }

        resolve(value);
      });
    });
  }

  async getValue(key: string): Promise<T | undefined> {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.get([key], function (s: { [key: string]: WrappedValue<T> }) {
        if (chrome.runtime.lastError) {
          // XXX return an UnoError
          return reject(chrome.runtime.lastError);
        }

        const w = s[key];
        if (w === undefined) return resolve(undefined);

        if (isExpired(w)) return resolve(undefined);

        return resolve(w.value);
      });
    });
  }

  async deleteValue(key: string): Promise<void> {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.remove([key], function () {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }

        resolve();
      });
    });
  }
}
