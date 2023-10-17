import { useEffect, useState } from "react";

import { useUnoOrchestrator } from "../../orchestrator/react";

/**
 * Returns the currently active element as local React state.
 */
export function useActiveElement(root?: Document | ShadowRoot) {
  const { root: orchestratorRoot } = useUnoOrchestrator();

  const [activeElement, setActiveElement] = useState(() => {
    return (root ?? orchestratorRoot).activeElement;
  });

  useEffect(() => {
    const onfocus = () => {
      setActiveElement((root ?? orchestratorRoot).activeElement);
    };

    const onblur = () => {
      setActiveElement((root ?? orchestratorRoot).activeElement);
    };

    (root ?? orchestratorRoot).addEventListener("focus", onfocus, true);
    (root ?? orchestratorRoot).addEventListener("blur", onblur, true);
    return () => {
      (root ?? orchestratorRoot).removeEventListener("focus", onfocus, true);
      (root ?? orchestratorRoot).removeEventListener("blur", onblur, true);
    };
  }, [root, orchestratorRoot]);

  return activeElement;
}
