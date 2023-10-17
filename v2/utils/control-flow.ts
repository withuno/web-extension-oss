import { isPromise } from "../types/type-guards";

/**
 * Executes the given `fn` wrapped with a try/catch to suppress uncaught errors.
 * If the function throws, `undefined` is returned instead.
 */
export function noThrow<T extends () => any>(fn: T): ReturnType<T> | undefined {
  try {
    const result = fn();
    if (isPromise(result)) {
      return Promise.resolve(result).catch(() => {}) as ReturnType<T>;
    }
    return result;
  } catch {
    return undefined;
  }
}
