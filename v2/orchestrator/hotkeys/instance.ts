import globalHotkeys, { HotkeysEvent } from "hotkeys-js";

/**
 * Get an instance of `hotkeys-js` without creating global reference conflicts.
 */
function getHotkeysInstance() {
  globalHotkeys.filter = () => true;

  // @ts-expect-error - Release the global variable injected by `hotkeys-js`.
  // `hotkeys-js` type definitions don't reflect the `deep` parameter, which
  // if `true` will restore any previously assigned global `hotkeys-js`
  // instance.
  return globalHotkeys.noConflict(true);
}

export const hotkeys = getHotkeysInstance();

export type HotkeyHandler = (keyboardEvent: KeyboardEvent, hotkeysEvent: HotkeysEvent) => void | Promise<void>;
