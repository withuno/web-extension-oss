import { clsx } from "clsx";

import { UnionToIntersection } from "../types/essentials";
import { mergeIDs } from "../ui/hooks/use-mergeable-id";

interface Props {
  [key: string]: any;
}
type PropsArg = Props | null | undefined;
type TupleTypes<T> = { [P in keyof T]: T[P] } extends { [key: number]: infer V } ? NullToObject<V> : never;
type NullToObject<T> = T extends null | undefined ? {} : T;

/**
 * Merges multiple props objects together. Event handlers are chained and
 * class names are combined For all other props, the latest prop object overrides
 * earlier ones.
 *
 * Based on `mergeProps` utility from `@react-aria/utils`
 *
 * @see the LICENSE file at the root of this source tree:
 *   https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/utils/src/mergeProps.ts
 *
 * Modifications from original source:
 *   - Removes `UNSAFE_className` compatibility (we don't need it)
 *   - Removes ID merging (rightmost ID takes precendence)
 *   - Adds `style` merging
 */
export function mergeProps<T extends PropsArg[]>(...args: T): UnionToIntersection<TupleTypes<T>> {
  // Start with a base clone of the first argument. This is a lot faster than starting
  // with an empty object and adding properties as we go.
  const result: Props = { ...args[0] };
  for (let i = 1; i < args.length; i++) {
    const props = args[i];

    for (const key in props) {
      const a = result[key];
      const b = props[key];

      // Chain events
      if (
        typeof a === "function" &&
        typeof b === "function" &&
        // This is a lot faster than a regex.
        key[0] === "o" &&
        key[1] === "n" &&
        key.charCodeAt(2) >= /* 'A' */ 65 &&
        key.charCodeAt(2) <= /* 'Z' */ 90
      ) {
        result[key] = chain(a, b);
      } else if (key === "className" && typeof a === "string" && typeof b === "string") {
        result[key] = clsx(a, b);
      } else if (key === "style" && typeof a === "object" && typeof b === "object") {
        result[key] = { ...a, ...b };
      } else if (key === "id" && a && b) {
        result.id = mergeIDs(a, b);
      } else {
        // Override others
        result[key] = b !== undefined ? b : a;
      }
    }
  }

  return result as UnionToIntersection<TupleTypes<T>>;
}

/**
 * Calls all functions in the order they were chained with the same arguments.
 *
 * Based on `chain` utility from `@react-aria/utils`
 *
 * @see the LICENSE file at the root of this source tree:
 *   https://github.com/adobe/react-spectrum/blob/main/packages/%40react-aria/utils/src/chain.ts
 *
 * Modifications from original source: none
 */
function chain(...callbacks: any[]): (...args: any[]) => void {
  return (...args: any[]) => {
    for (const callback of callbacks) {
      if (typeof callback === "function") {
        callback(...args);
      }
    }
  };
}
