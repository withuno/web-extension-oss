// TODO: add Tailwind to Popup...
// For now, Tailwind's CSS reset breaks some of our Popup styling conventions.
// A rewrite is required.
// import "./ui/styles/main.css";

import "./utils/logger";

import { createRoot } from "react-dom/client";

import { Zone, UnoOrchestrator } from "./orchestrator";
import { initializeSentryClient, initializeSentryUser } from "./orchestrator/errors";
import { UnoOrchestratorProvider } from "./orchestrator/react";
import PopupApp from "./ui/popup/PopupApp";
import { waitForDocumentReady } from "./utils/dom";

function main() {
  const orchestrator = new UnoOrchestrator(Zone.Popup);

  waitForDocumentReady().then(async () => {
    await orchestrator.initialize();
    await initializeSentryUser(orchestrator);

    const root = createRoot(document.body);
    root.render(
      <UnoOrchestratorProvider orchestrator={orchestrator} root={document}>
        <PopupApp />
      </UnoOrchestratorProvider>,
    );
  });
}

initializeSentryClient(Zone.Popup);
main();
