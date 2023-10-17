import { useState } from "react";

import { useConst } from "usable-react";

export type BooleanState = ReturnType<typeof useBoolean>;
export type BooleanSetter = BooleanState[1];

/**
 * Maintains boolean-based state.
 *
 * Returns shortcuts like `setTruthy` and `setFalsey`,
 * which can be passed directly to event handlers.
 */
export function useBoolean(init?: boolean | (() => boolean)) {
  const [state, setState] = useState(init ?? false);

  const setters = useConst(() => {
    return {
      set: setState,

      on: () => {
        setState(true);
      },

      off: () => {
        setState(false);
      },

      toggle: () => {
        setState((curr) => !curr);
      },
    };
  });

  return [state, setters] as const;
}
