import { subscribe, SubscribeCallback } from "@parcel/watcher";

export type { SubscribeCallback };

export interface Watcher {
  addListener(fn: SubscribeCallback): void;
  removeListener(fn: SubscribeCallback): void;
  close(): Promise<void>;
}

export async function createWatcher(dir: string) {
  if (createWatcher.cache.has(dir)) {
    return createWatcher.cache.get(dir)!;
  }

  try {
    const listeners = new Set<SubscribeCallback>();
    const subscription = await subscribe(dir, async (err, events) => {
      return Promise.all(
        [...listeners.values()].map((fn) => {
          return Promise.resolve(fn(err, events));
        }),
        // eslint-disable-next-line @typescript-eslint/no-empty-function
      ).catch(() => {});
    });

    const result: Watcher = {
      addListener: (fn) => {
        listeners.add(fn);
      },
      removeListener: (fn) => {
        listeners.delete(fn);
      },
      close: () => subscription.unsubscribe(),
    };

    createWatcher.cache.set(dir, result);

    return result;
  } catch (err) {
    createWatcher.cache.delete(dir);
    throw err;
  }
}

createWatcher.cache = new Map<string, Watcher>();
