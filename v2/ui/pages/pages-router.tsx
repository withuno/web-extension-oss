import { useConst } from "usable-react";

import { useUnoOrchestrator } from "@/v2/orchestrator/react";

import { Router, createHashHistory } from "../router";

/**
 * Routes top-level pages using `window.history` APIs.
 */
export function PagesRouter() {
  const { pageRoutes } = useUnoOrchestrator();

  const history = useConst(() => {
    return createHashHistory();
  });

  return <Router history={history} routes={pageRoutes} />;
}
