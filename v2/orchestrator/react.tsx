import { createContext, useContext, useMemo, StrictMode } from "react";

import { useConst } from "usable-react";

import { UnoError } from "./errors";
import { HotkeyProvider } from "./hotkeys/react";
import { UnoOrchestrator } from "./index";
import { UnoContainer } from "../ui/components/uno-custom-elements";
import { WithChildren } from "../ui/prop.types";
import { RouteConfig } from "../ui/router";

export interface UnoOrchestratorContext {
  orchestrator: UnoOrchestrator;
  root: Document | ShadowRoot;
  layerRoutes: RouteConfig[];
  pageRoutes: RouteConfig[];
}

const UnoOrchestratorContext = createContext<UnoOrchestratorContext | null>(null);

/**
 * A React Hook returning the `UnoOrchestrator` instance for this execution
 * context.
 */
export function useUnoOrchestrator(): UnoOrchestratorContext {
  const ctx = useContext(UnoOrchestratorContext);
  if (ctx == null) {
    throw new UnoError(UnoError.Code.OrchestratorUndefined);
  }
  return ctx;
}

export interface UnoOrchestratorProviderProps
  extends WithChildren,
    Pick<UnoOrchestratorContext, "orchestrator" | "root"> {}

/**
 * Wraps a React tree with an `UnoOrchestrator` instance.
 */
export function UnoOrchestratorProvider(props: UnoOrchestratorProviderProps) {
  const { orchestrator, root, children } = props;

  const layerRoutes = useConst(() => {
    return UnoOrchestrator.getRegisteredLayerRoutes();
  });

  const pageRoutes = useConst(() => {
    return UnoOrchestrator.getRegisteredPageRoutes();
  });

  const ctx = useMemo<UnoOrchestratorContext>(() => {
    return { orchestrator, root, layerRoutes, pageRoutes };
  }, [orchestrator, root, layerRoutes, pageRoutes]);

  return (
    <StrictMode>
      <UnoOrchestratorContext.Provider value={ctx}>
        <HotkeyProvider>
          <UnoContainer>{children}</UnoContainer>
        </HotkeyProvider>
      </UnoOrchestratorContext.Provider>
    </StrictMode>
  );
}
