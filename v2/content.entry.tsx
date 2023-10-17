import "./ui/styles/main.css";
import "./utils/logger";

import { createRoot } from "react-dom/client";
import { v4 as uuid } from "uuid";

import { InitializeAutocompleteController } from "./actions/autocomplete/initialize-autocomplete-controller.action";
import { PopulateSiteItems } from "./actions/vault/populate-site-items.action";
import { Zone, UnoOrchestrator } from "./orchestrator";
import { initializeSentryClient, initializeSentryUser } from "./orchestrator/errors";
import { UnoOrchestratorProvider } from "./orchestrator/react";
import { RenderLayers } from "./ui/layers/render-layers";
import { isIframe, waitForDocumentReady } from "./utils/dom";

function main() {
  const orchestrator = new UnoOrchestrator(Zone.Content);
  decorateIframesWithRuntimeInfo(orchestrator);

  if (isIframe()) {
    waitForDocumentReady().then(async () => {
      await orchestrator.initialize();
      await render(orchestrator);
    });
  } else {
    enableHotReload(orchestrator);
    waitForDocumentReady().then(async () => {
      const { injectV2UnoOrchestrator } = await import("@/v1/content/content_script");
      await orchestrator.initialize();
      injectV2UnoOrchestrator(orchestrator);
      initializeSentryUser(orchestrator);
      await orchestrator.useAction(PopulateSiteItems)();
      orchestrator.useAction(InitializeAutocompleteController)(); // Note: intentionally not awaited...
      await render(orchestrator);
    });
  }
}

/**
 * Renders the React app for this content script.
 */
async function render(orchestrator: UnoOrchestrator) {
  const container = document.createElement("uno-content-scripts");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.zIndex = "2147483647";
  container.style.pointerEvents = "none";

  const css = await fetch(chrome.runtime.getURL("content.entry.css")).then((res) => res.text());
  const style = document.createElement("style");
  style.innerHTML = css;

  const shadow = container.attachShadow({
    mode: process.env.ENV_NAME === "e2e" ? "open" : "closed",
  });

  shadow.appendChild(style);
  document.body.appendChild(container);

  const root = createRoot(shadow);
  root.render(
    <UnoOrchestratorProvider orchestrator={orchestrator} root={shadow}>
      <RenderLayers />
    </UnoOrchestratorProvider>,
  );
}

/**
 * We rely on sub-resource iframes to find and reveal the value of
 * `orchestrator.runtimeInfo.frameID` to their parent window so we may
 * coordinate operations between all documents contained in a page. To achieve
 * this, we create a `postMessage` listener and basically hope for the best.
 * This approach is somewhat brittle, but it's the only cross-browser solution
 * we have.
 *
 * Note: `chrome.runtime.getFrameId()` is being actively discussed as part of
 * the web extension spec, but there is not yet consensus between browser
 * maintainers about it's security merit.
 */
function decorateIframesWithRuntimeInfo(orchestrator: UnoOrchestrator<Zone.Content>) {
  const frameIDRequestQueue = new Map();

  window.addEventListener(
    "message",
    (e) => {
      if (typeof e.data === "string" && e.data.startsWith(chrome.runtime.id)) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const messageData = JSON.parse(e.data.split("::")[1]);

        switch (messageData.kind) {
          // "iframe" -> "parent": tell the parent window that a new iframe has mounted
          case "frame-id/init": {
            const iframes = document.getElementsByTagName("iframe");
            for (const iframe of iframes) {
              if (!iframe.hasAttribute("data-uno-frame-id")) {
                const requestID = uuid();
                frameIDRequestQueue.set(requestID, iframe);
                const requestJSON = JSON.stringify({ kind: "frame-id/request", requestID });
                iframe.contentWindow?.postMessage(`${chrome.runtime.id}::${requestJSON}`, "*");
              }
            }
            break;
          }

          // "parent" -> "iframe": parent window requests the value of `orchestrator.runtimeInfo.frameID`
          case "frame-id/request": {
            orchestrator.initialized.then(() => {
              const responseJSON = JSON.stringify({
                kind: "frame-id/result",
                payload: orchestrator.runtimeInfo.frameID,
                requestID: messageData.requestID,
              });
              window.parent.postMessage(`${chrome.runtime.id}::${responseJSON}`, "*");
            });
            break;
          }

          // "iframe" -> "parent": parent window receives the value of `orchestrator.runtimeInfo.frameID`
          case "frame-id/result": {
            if (frameIDRequestQueue.has(messageData.requestID)) {
              const iframe = frameIDRequestQueue.get(messageData.requestID);
              iframe.setAttribute("data-uno-frame-id", messageData.payload);
            }
            break;
          }
        }
      }
    },
    false,
  );

  if (isIframe()) {
    const initJSON = JSON.stringify({ kind: "frame-id/init" });
    window.parent.postMessage(`${chrome.runtime.id}::${initJSON}`, "*");
  }
}

/**
 * Reloads the extension runtime during development if a "reload" event is
 * received by the build server.
 */
function enableHotReload(orchestrator: UnoOrchestrator) {
  if (process.env.WATCH === "true") {
    orchestrator.events.on("hot-reload", () => {
      console.log("[hot-reload] reloading...");
      window.location.reload();
    });
  }
}

initializeSentryClient(Zone.Content);
main();
