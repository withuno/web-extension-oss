import "./ui/styles/main.css";
import "./utils/logger";

import { useState, useEffect } from "react";

import { createRoot } from "react-dom/client";

import { messageToJSON, messageFromJSON } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "./orchestrator";
import { initializeSentryClient, initializeSentryUser } from "./orchestrator/errors";
import { UnoOrchestratorProvider } from "./orchestrator/react";
import { waitForDocumentReady } from "./utils/dom";

function main() {
  const orchestrator = new UnoOrchestrator(Zone.Content);

  waitForDocumentReady().then(async () => {
    await orchestrator.initialize();
    await initializeSentryUser(orchestrator);

    const root = createRoot(document.body);
    root.render(
      <UnoOrchestratorProvider orchestrator={orchestrator} root={document}>
        <DebugViewVault />
      </UnoOrchestratorProvider>,
    );
  });
}

function DebugViewVault() {
  const [vaultJSON, setVaultJSON]: [string, any] = useState("loading...");

  // TODO: refactor to a V2 action...
  // @start V1_COMPAT
  useEffect(() => {
    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_VAULT_RAW", payload: true }), function (r) {
      const message = messageFromJSON(r);

      switch (message.kind) {
        case "GET_VAULT_RAW_SUCCESS":
          setVaultJSON(JSON.stringify(message.payload, null, "\t"));
          break;
        default:
          setVaultJSON("error.");
      }
    });
  }, []);
  // @end V1_COMPAT

  return (
    <div>
      <pre>{vaultJSON}</pre>
    </div>
  );
}

initializeSentryClient(Zone.Content);
main();
