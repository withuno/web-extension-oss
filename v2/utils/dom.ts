import { createColorFromCSS, getLightness } from "@/v2/utils/colors";
import { OS, Engine } from "@/v2/utils/platform";

import { isHTMLElement } from "../types/type-guards";

/**
 * @returns a promise that resolves once the DOM is interactive.
 */
export function waitForDocumentReady() {
  return new Promise<void>((resolve) => {
    if (["interactive", "complete"].includes(document.readyState)) {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        resolve();
      });
    }
  });
}

/**
 * @returns a boolean indicating whether the current window is rendered in an
 * `<iframe>`.
 */
export function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export namespace WebDriver {
  export namespace Field {
    export type TextualElement = HTMLInputElement | HTMLTextAreaElement;

    /**
     * @returns a boolean indicating whether the `target` element is textual.
     *
     * NOTE: We're not worried about, nor do we handle "contenteditible"
     * fields...
     */
    export function isTextual(target: HTMLElement): target is TextualElement {
      if (target.tagName === "TEXTAREA") {
        return true;
      }

      if (target.tagName === "INPUT") {
        const type = target.getAttribute("type")?.toLowerCase();
        return type != null && ["text", "search", "tel", "url", "email", "password", "number"].includes(type);
      }

      return false;
    }

    /**
     * @returns a boolean indicating whether the `target` element is editible.
     *
     * NOTE: We're not worried about, nor do we handle "contenteditible"
     * fields...
     */
    export function isEditable(target: HTMLElement): target is TextualElement {
      const type = target.getAttribute("type")?.toLowerCase();
      return (
        (isTextual(target) ||
          ["file", "range", "date", "month", "week", "time", "datetime-local", "color"].includes(type!)) &&
        !(target as TextualElement).readOnly
      );
    }

    /**
     * Clears the current value from the `target` element, if that element is
     * editible.
     */
    export function clear(target: HTMLElement) {
      if (!isEditable(target)) {
        // Element must be user-editable in order to clear it.
        return;
      }
      Mouse.simulateClick(target);
      target.value = "";
      target.blur();
    }

    /**
     * Finds the next, valid element in the document's tab index, then
     * focuses it.
     */
    export function focusNext(from?: HTMLElement) {
      // Get all elements that can be focusable.
      const tabbableElements = Array.from<HTMLElement>(
        document.querySelectorAll("a, button, input, textarea, select, details, [tabindex]"),
      )
        // Remove elements that have a tabIndex of -1
        .filter((element) => element.tabIndex > -1)
        // Split elements into two arrays: explicit `tabIndexes` and implicit ones
        .reduce(
          (prev, next) => {
            return next.tabIndex > 0
              ? [[...prev[0], next].sort((a, b) => (a.tabIndex > b.tabIndex ? -1 : 1)), prev[1]]
              : [prev[0], [...prev[1], next]];
          },
          [[], []] as Array<HTMLElement[]>,
        )
        // Flatten the two-dimensional array
        .flatMap((element) => element);

      const fromElementResolved = from ?? document.activeElement;

      // If the current focused element is a -1 then we wont find the index in
      // the elements list, got to the start.
      if (isHTMLElement(fromElementResolved) && fromElementResolved.tabIndex === -1) {
        tabbableElements[0].focus();
        return;
      }

      // Find the current index in the tab list of the currently focused
      // element.
      const currentIndex = tabbableElements.findIndex((e) => e === fromElementResolved);

      // Get the next element in the list.
      // "%" (modulo) will loop the index around to "0".
      const nextIndex = (currentIndex + 1) % tabbableElements.length;
      tabbableElements[nextIndex].focus();
    }
  }

  export namespace Keyboard {
    /**
     * Dispatches a sequence of synthetic DOM events to simulate typing the
     * given `value` into the given `target` element, if that element is
     * editible.
     */
    export function simulateTyping(target: HTMLElement, value: string) {
      if (!Field.isEditable(target)) {
        // Element must be user-editable in order to type in it.
        return;
      }

      for (const char of value) {
        const key = Keyboard.Key.fromChar(char);
        Keyboard.Events.dispatchSyntheticKeyboardEvent(target, "keydown", key);
        Keyboard.Events.dispatchSyntheticKeyboardEvent(target, "keypress", key);
        target.value += char;
        target.dispatchEvent(new window.Event("input", { bubbles: true, cancelable: true }));
        Keyboard.Events.dispatchSyntheticKeyboardEvent(target, "keyup", key);
      }

      setFilledAttribute(target);

      target.blur();
    }

    /**
     * Sets a theme attribute upon the `target` element, which in-effect changes
     * the "background-color" of the element to indicate it has been manipulated
     * by Uno. We also add an "input" event listener to unset the attribute if
     * the user manually edits the field.
     */
    function setFilledAttribute(target: HTMLElement) {
      const computedBackgroundColor = window.getComputedStyle(target).backgroundColor;
      const bgColor = createColorFromCSS(computedBackgroundColor);

      if (bgColor.alpha > 0.5 && computedBackgroundColor !== "transparent") {
        const theme = getLightness(bgColor) > 0.5 ? "light" : "dark";
        return target.setAttribute(setFilledAttribute.attr, theme);
      }

      const computedTextColor = window.getComputedStyle(target).color;
      const textColor = createColorFromCSS(computedTextColor);
      const theme = getLightness(textColor) < 0.5 ? "light" : "dark";
      target.setAttribute(setFilledAttribute.attr, theme);

      const removeFilledAttributeUponUserInteract = () => {
        if (target.hasAttribute(setFilledAttribute.attr)) {
          target.removeAttribute(setFilledAttribute.attr);
        }
        target.removeEventListener("input", removeFilledAttributeUponUserInteract);
      };
      target.addEventListener("input", removeFilledAttributeUponUserInteract);
    }
    setFilledAttribute.attr = "data-uno-filled";

    export interface KeyShiftPair {
      key: Key;
      shiftKey: boolean;
    }

    export class Key {
      private static _char_to_key: Record<string, KeyShiftPair> = {};

      public code: number | null;
      public char: string | null;
      public shiftChar: string | null;

      constructor(config: number | { gecko: number | null; webkit: number | null }, char?: string, shiftChar?: string) {
        if (typeof config === "object") {
          if (Engine.isGecko) {
            this.code = config.gecko;
          } else {
            this.code = config.webkit;
          }
        } else {
          this.code = config;
        }

        this.char = char ?? null;
        this.shiftChar = shiftChar ?? this.char;

        // For a character key, potentially map the character to the key in the
        // CHAR_TO_KEY_ map. Because of numpad, multiple keys may have the same
        // character. To avoid mapping numpad keys, we overwrite a mapping only
        // if the key has a distinct shift character.
        if (char != null && (!(char in Key._char_to_key) || shiftChar != null)) {
          Key._char_to_key[char] = { key: this, shiftKey: false };
          if (shiftChar != null) {
            Key._char_to_key[shiftChar] = { key: this, shiftKey: true };
          }
        }
      }

      public static fromChar(char: string) {
        let keyShiftPair = Key._char_to_key[char];
        if (!keyShiftPair) {
          // We don't know the true keycode of non-US keyboard characters, but
          // ch.toUpperCase().charCodeAt(0) should occasionally be right, and at
          // least yield a positive number.
          const upperCase = char.toUpperCase();
          const keyCode = upperCase.charCodeAt(0);
          const key = new Key(keyCode, char.toLowerCase(), upperCase);
          keyShiftPair = { key, shiftKey: char != key.char };
        }
        return keyShiftPair;
      }
    }

    export const StandardKeys = {
      // Auxillary keys
      BACKSPACE: new Key(8),
      TAB: new Key(9),
      ENTER: new Key(13),
      SHIFT: new Key(16),
      CONTROL: new Key(17),
      ALT: new Key(18),
      PAUSE: new Key(19),
      CAPS_LOCK: new Key(20),
      ESC: new Key(27),
      SPACE: new Key(32, " "),
      PAGE_UP: new Key(33),
      PAGE_DOWN: new Key(34),
      END: new Key(35),
      HOME: new Key(36),
      LEFT: new Key(37),
      UP: new Key(38),
      RIGHT: new Key(39),
      DOWN: new Key(40),
      PRINT_SCREEN: new Key(44),
      INSERT: new Key(45),
      DELETE: new Key(46),

      // Number keys
      ZERO: new Key(48, "0", ")"),
      ONE: new Key(49, "1", "!"),
      TWO: new Key(50, "2", "@"),
      THREE: new Key(51, "3", "#"),
      FOUR: new Key(52, "4", "$"),
      FIVE: new Key(53, "5", "%"),
      SIX: new Key(54, "6", "^"),
      SEVEN: new Key(55, "7", "&"),
      EIGHT: new Key(56, "8", "*"),
      NINE: new Key(57, "9", "("),

      // Letter keys
      A: new Key(65, "a", "A"),
      B: new Key(66, "b", "B"),
      C: new Key(67, "c", "C"),
      D: new Key(68, "d", "D"),
      E: new Key(69, "e", "E"),
      F: new Key(70, "f", "F"),
      G: new Key(71, "g", "G"),
      H: new Key(72, "h", "H"),
      I: new Key(73, "i", "I"),
      J: new Key(74, "j", "J"),
      K: new Key(75, "k", "K"),
      L: new Key(76, "l", "L"),
      M: new Key(77, "m", "M"),
      N: new Key(78, "n", "N"),
      O: new Key(79, "o", "O"),
      P: new Key(80, "p", "P"),
      Q: new Key(81, "q", "Q"),
      R: new Key(82, "r", "R"),
      S: new Key(83, "s", "S"),
      T: new Key(84, "t", "T"),
      U: new Key(85, "u", "U"),
      V: new Key(86, "v", "V"),
      W: new Key(87, "w", "W"),
      X: new Key(88, "x", "X"),
      Y: new Key(89, "y", "Y"),
      Z: new Key(90, "z", "Z"),

      // Branded keys
      META: new Key(
        OS.isWindows ? 91 : OS.isMac ? { gecko: 224, webkit: 91 } : { gecko: 0, webkit: 91 }, // Linux
      ),
      META_RIGHT: new Key(
        OS.isWindows ? 92 : OS.isMac ? { gecko: 224, webkit: 93 } : { gecko: 0, webkit: 92 }, // Linux
      ),
      CONTEXT_MENU: new Key(
        OS.isWindows ? 93 : OS.isMac ? 0 : { gecko: 93, webkit: null }, // Linux
      ),

      // Numpad keys
      NUMPAD_ZERO: new Key(96, "0"),
      NUMPAD_ONE: new Key(97, "1"),
      NUMPAD_TWO: new Key(98, "2"),
      NUMPAD_THREE: new Key(99, "3"),
      NUMPAD_FOUR: new Key(100, "4"),
      NUMPAD_FIVE: new Key(101, "5"),
      NUMPAD_SIX: new Key(102, "6"),
      NUMPAD_SEVEN: new Key(103, "7"),
      NUMPAD_EIGHT: new Key(104, "8"),
      NUMPAD_NINE: new Key(105, "9"),
      NUMPAD_MULTIPLY: new Key(106, "*"),
      NUMPAD_PLUS: new Key(107, "+"),
      NUMPAD_MINUS: new Key(109, "-"),
      NUMPAD_PERIOD: new Key(110, "."),
      NUMPAD_DIVISION: new Key(111, "/"),
      NUMPAD_LOCK: new Key(144),

      // Function keys
      F1: new Key(112),
      F2: new Key(113),
      F3: new Key(114),
      F4: new Key(115),
      F5: new Key(116),
      F6: new Key(117),
      F7: new Key(118),
      F8: new Key(119),
      F9: new Key(120),
      F10: new Key(121),
      F11: new Key(122),
      F12: new Key(123),

      // Punctuation keys
      EQUALS: new Key({ gecko: 107, webkit: 187 }, "=", "+"),
      SEPARATOR: new Key(108, ","),
      HYPHEN: new Key({ gecko: 109, webkit: 189 }, "-", "_"),
      COMMA: new Key(188, ",", "<"),
      PERIOD: new Key(190, ".", ">"),
      SLASH: new Key(191, "/", "?"),
      BACKTICK: new Key(192, "`", "~"),
      OPEN_BRACKET: new Key(219, "[", "{"),
      BACKSLASH: new Key(220, "\\", "|"),
      CLOSE_BRACKET: new Key(221, "]", "}"),
      SEMICOLON: new Key({ gecko: 59, webkit: 186 }, ";", ":"),
      APOSTROPHE: new Key(222, "'", '"'),

      // Modifier keys
      get MODIFIERS() {
        return [
          Keyboard.StandardKeys.ALT,
          Keyboard.StandardKeys.CONTROL,
          Keyboard.StandardKeys.META,
          Keyboard.StandardKeys.SHIFT,
        ];
      },
    };

    export namespace Events {
      export interface SyntheticKeyboardEventInit extends Omit<KeyboardEventInit, "key" | "keyCode" | "charCode"> {
        key: Key;
      }

      /**
       * Emits a synthetic `KeyboardEvent` to the given `target` element. Some
       * traditional `KeyboardEvent` options are replaced by our internal `Key`
       * class.
       */
      export function dispatchSyntheticKeyboardEvent(
        target: HTMLElement,
        type: string,
        init: SyntheticKeyboardEventInit,
      ) {
        if (init.key.code != null) {
          // Key must have a keycode to be fired.
          return;
        }

        const keyboardEvent = new window.KeyboardEvent(type, {
          ...init,
          key: (init.shiftKey ? init.key.shiftChar ?? init.key.char : init.key.char) ?? undefined,
          keyCode: init.key.code ?? undefined,
          charCode:
            init.key.char && type === "keypress"
              ? init.shiftKey
                ? init.key.shiftChar?.charCodeAt(0) ?? init.key.char.charCodeAt(0)
                : init.key.char.charCodeAt(0)
              : 0,
        });

        return target.dispatchEvent(keyboardEvent);
      }
    }
  }

  export namespace Mouse {
    export enum ButtonType {
      Primary, // left click
      Secondary, // right click
    }

    /**
     * Dispatches a sequence of synthetic DOM events to simulate clicking the
     * given `target` element.
     */
    export function simulateClick(target: HTMLElement) {
      simulateMoveTo(target);
      simulateButtonPress(target);
      simulateButtonRelease();
    }

    /**
     * Dispatches a sequence of synthetic DOM events to simulate pressing a
     * mouse button over the given `target` element.
     */
    export function simulateButtonPress(target: HTMLElement, button = ButtonType.Primary) {
      simulateButtonPress.target = target;
      simulateButtonPress.buttonType = button;

      // On some browsers, if the mousedown event handler makes a focus() call to
      // change the active element, this preempts the focus that would happen by
      // default on the mousedown, so we should not explicitly focus in this case.
      let beforeActiveElement: Element | null = null;
      const mousedownCanPreemptFocus = Engine.isGecko;
      if (mousedownCanPreemptFocus) {
        beforeActiveElement = document.activeElement;
      }

      // On some browsers, a mouse down event on an OPTION or SELECT element cause
      // the SELECT to open, blocking further JS execution. This is undesirable,
      // and so needs to be detected. We always focus in this case.
      const blocksOnMousedown = Engine.isWebkit && (target.tagName === "OPTION" || target.tagName === "SELECT");

      const performFocus =
        blocksOnMousedown ||
        Mouse.Events.dispatchSyntheticMouseEvent(target, "mousedown", {
          button,
          bubbles: true,
          cancelable: true,
        });

      if (performFocus) {
        if (!mousedownCanPreemptFocus && beforeActiveElement === document.activeElement) {
          target.focus();
        }
      }
    }
    simulateButtonPress.target = null as HTMLElement | null;
    simulateButtonPress.buttonType = null as ButtonType | null;

    /**
     * Dispatches a sequence of synthetic DOM events to simulate releasing the
     * mouse button previously pressed over the given `target` element.
     */
    export function simulateButtonRelease() {
      if (simulateButtonPress.buttonType == null) {
        // Cannot release a button when no button is pressed.
        return;
      }

      Mouse.Events.dispatchSyntheticMouseEvent(simulateButtonPress.target!, "mouseup", {
        button: simulateButtonPress.buttonType,
        bubbles: true,
        cancelable: true,
      });

      try {
        if (simulateButtonPress.buttonType === ButtonType.Primary) {
          if (simulateButtonPress.target?.tagName !== "OPTION") {
            Mouse.Events.dispatchSyntheticMouseEvent(simulateButtonPress.target!, "click", {
              button: simulateButtonPress.buttonType,
              bubbles: true,
              cancelable: true,
            });
          }
        } else if (simulateButtonPress.buttonType === ButtonType.Secondary) {
          Mouse.Events.dispatchSyntheticMouseEvent(simulateButtonPress.target!, "contextmenu", {
            button: simulateButtonPress.buttonType,
            bubbles: true,
            cancelable: true,
          });
        }
      } catch {
        // Ignore errors...
      }

      simulateButtonPress.buttonType = null;
      simulateButtonPress.target = null;
    }

    /**
     * Dispatches a sequence of synthetic DOM events to simulate moving the
     * mouse pointer over the given `target` element.
     */
    export function simulateMoveTo(target: HTMLElement) {
      const fromElement = simulateMoveTo.relatedTarget;

      if (target != fromElement) {
        if (fromElement) {
          // For the first mouse interaction on a page, if the mouse was over the
          // browser window, the browser will pass null as the relatedTarget for the
          // mouseover event. For subsequent interactions, it will pass the
          // last-focused element.
          Mouse.Events.dispatchSyntheticMouseEvent(fromElement, "mouseout", {
            relatedTarget: target,
          });
        }
        simulateMoveTo.relatedTarget = target;

        Mouse.Events.dispatchSyntheticMouseEvent(target, "mouseover", {
          relatedTarget: fromElement,
        });
      }

      Mouse.Events.dispatchSyntheticMouseEvent(target, "mousemove");
    }
    simulateMoveTo.relatedTarget = null as HTMLElement | null;

    export namespace Events {
      export interface SyntheticMouseEventInit extends Omit<MouseEventInit, "view" | "clientX" | "clientY"> {
        button?: Mouse.ButtonType;
      }

      /**
       * Emits a synthetic `MouseEvent` to the given `target` element. Some
       * traditional `MouseEvent` options are gleaned automatically from the
       * `target`, including `clientX` and `clientY` (defaulting to the target's
       * center coordinate).
       */
      export function dispatchSyntheticMouseEvent(target: HTMLElement, type: string, init?: SyntheticMouseEventInit) {
        const { left, top, width, height } = target.getBoundingClientRect();
        const center = {
          x: left + width / 2,
          y: top + height / 2,
        };

        const mouseEvent = new window.MouseEvent(type, {
          ...init,
          view: window,
          clientX: center.x,
          clientY: center.y,
        });

        return target.dispatchEvent(mouseEvent);
      }
    }
  }
}
