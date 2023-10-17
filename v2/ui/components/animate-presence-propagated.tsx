import { useCallback } from "react";

import { AnimatePresence, AnimatePresenceProps, usePresence } from "framer-motion";

import { WithChildren } from "../prop.types";

export namespace AnimatePresencePropagated {
  export interface Props extends WithChildren, AnimatePresenceProps {}
}

/**
 * Equivalent to Framer Motion's `<AnimatePresence>` component with the added
 * benefit of waiting for nested exit animations to complete in sequence.
 */
export function AnimatePresencePropagated(props: AnimatePresencePropagated.Props) {
  const { onExitComplete, children, ...presenceProps } = props;

  const [isPresent, safeToRemove] = usePresence();
  const handleUnmount = useCallback(() => {
    onExitComplete?.();
    if (!isPresent) {
      safeToRemove();
    }
  }, [isPresent, safeToRemove, onExitComplete]);

  return (
    <AnimatePresence {...presenceProps} onExitComplete={handleUnmount}>
      {isPresent && children}
    </AnimatePresence>
  );
}
