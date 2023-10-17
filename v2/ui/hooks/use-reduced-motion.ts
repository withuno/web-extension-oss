import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: no-preference)";

function useInitialReducedMotionState() {
  return () => !window.matchMedia(QUERY).matches;
}

/**
 * Returns `boolean` indicating whether the user has set
 * their browser to prefer reduced motion animations.
 *
 * Based on this lovely tutorial by Josh Comeau:
 * https://www.joshwcomeau.com/react/prefers-reduced-motion/
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(useInitialReducedMotionState());

  useEffect(() => {
    const mediaQueryList = window.matchMedia(QUERY);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(!event.matches);
    };

    // TODO: update to non-deprecated API.
    mediaQueryList.addListener(listener);
    return () => mediaQueryList.removeListener(listener);
  }, []);

  return prefersReducedMotion;
}
