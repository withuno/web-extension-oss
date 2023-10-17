import { useRef, useId, useLayoutEffect } from "react";

import { useForceUpdate, useCallbackConst } from "usable-react";

const idUpdaters: Map<string, (v: string) => void> = new Map();

/**
 * Returns a unique, mergeable react ID.
 *
 * Based on `useId` utility from `@react-aria/utils`
 *
 * @see the LICENSE file at the root of this source tree:
 *   https://github.com/adobe/react-spectrum/blob/main/packages/@react-aria/utils/src/useId.ts
 *
 * Modifications from original source:
 *   - Removes SSR considerations (we're client-side-only).
 *   - Uses React 18's built-in `useId` hook to create the seed ID.
 *   - Returns latest ID from a ref container, rather than component state.
 */
export function useMergeableID(): string {
  const forceUpdate = useForceUpdate();
  const seedID = useId();
  const idRef = useRef<string>(seedID);

  const updateValue = useCallbackConst((val: string) => {
    if (idRef.current !== val) {
      idRef.current = val;
      forceUpdate();
    }
  });

  useLayoutEffect(() => {
    const s = seedID;
    return () => {
      idUpdaters.delete(s);
    };
  }, []);

  idUpdaters.set(seedID, updateValue);
  return idRef.current;
}

/**
 * Merges two ids.
 *
 * Based on `mergeIds` utility from `@react-aria/utils`
 *
 * @see the LICENSE file at the root of this source tree:
 *   https://github.com/adobe/react-spectrum/blob/main/packages/@react-aria/utils/src/useId.ts
 *
 * Modifications from original source: none
 */
export function mergeIDs(a: string, b: string): string {
  if (a === b) {
    return a;
  }

  const setA = idUpdaters.get(a);
  if (setA) {
    setA(b);
    return b;
  }

  const setB = idUpdaters.get(b);
  if (setB) {
    setB(a);
    return a;
  }

  return b;
}
