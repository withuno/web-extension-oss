import Semaphore from "semaphore-async-await";

/**
 * @returns a Promise that resolves after `timeout` milliseconds.
 */
export function sleep(timeout: number) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

/**
 * A simple implementation of a "deferred" value, wrapping a native JS Promise
 * with functionality to expose the resolve/reject callbacks. This allows the
 * Promise to be finalized from another scope.
 */
export class Deferred<T> {
  public promise: Promise<T>;
  public resolve!: (value: T | PromiseLike<T>) => void;
  public reject!: (reason?: any) => void;
  public state: "pending" | "fulfilled" | "rejected";

  constructor() {
    this.state = "pending";
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    })
      .then((result) => {
        this.state = "fulfilled";
        return result;
      })
      .catch((err) => {
        this.state = "rejected";
        throw err;
      });
  }
}

/**
 * Throttles the given `callback` using `requestAnimationFrame`.
 */
export function throttleAnimationFrame<T extends (...args: any[]) => void>(callback: T): T {
  let id: number | null = null;
  return ((...args: any[]) => {
    if (id) return;
    id = requestAnimationFrame(() => {
      callback(...args);
      id = null;
    });
  }) as T;
}

/**
 * Performs an atomic action.
 */
export interface AtomicHandler {
  <T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Creates an `AtomicHandler` function, which can be used to control concurrency
 * with plain-old async/await syntax.
 */
export function createAtomicHandler(concurrency = 1): AtomicHandler {
  const lock = new Semaphore(concurrency);

  return async (fn) => {
    let didAcquireLock = false;
    try {
      didAcquireLock = await lock.acquire();
      return fn();
    } finally {
      if (didAcquireLock) {
        lock.release();
      }
    }
  };
}
