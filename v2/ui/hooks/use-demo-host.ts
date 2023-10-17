import { useMemo } from "react";

/**
 * @returns `true` if the current window location is located at
 * "https://demo.uno.app", `false` otherwise.
 */
export function useIsDemoHost() {
  return useMemo(() => {
    return isDemoHost();
  }, [window.location.host]);
}

/**
 * @returns `true` if the current window location is located at
 * "https://demo.uno.app", `false` otherwise.
 */
export function isDemoHost() {
  return window.location.host.includes("demo.uno");
}
