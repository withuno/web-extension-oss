import "./ui/styles/main.css";
import "./utils/logger";

import { createRoot } from "react-dom/client";

import { Zone, UnoOrchestrator } from "./orchestrator";
import { initializeSentryClient, initializeSentryUser } from "./orchestrator/errors";
import { UnoOrchestratorProvider } from "./orchestrator/react";
import { PagesRouter } from "./ui/pages/pages-router";
import { waitForDocumentReady } from "./utils/dom";

function main() {
  const orchestrator = new UnoOrchestrator(Zone.Content);

  waitForDocumentReady().then(async () => {
    await orchestrator.initialize();
    await initializeSentryUser(orchestrator);

    const root = createRoot(document.body);
    root.render(
      <UnoOrchestratorProvider orchestrator={orchestrator} root={document}>
        <PagesRouter />
      </UnoOrchestratorProvider>,
    );
  });
}

initializeSentryClient(Zone.Content);
main();
