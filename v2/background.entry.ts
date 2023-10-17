import "./utils/logger";

import "@/v1/background";

import { RemoveEphemeralLayersForTab } from "./actions/layers/remove-ephemeral-layers-for-tab.action";
import { ResetAllLayers } from "./actions/layers/reset-all-layers.action";
import { ResetLayersForTab } from "./actions/layers/reset-layers-for-tab.action";
import { OpenWhatsNew } from "./actions/whats-new/open-whats-new.action";
import { Zone, UnoOrchestrator } from "./orchestrator";
import { initializeSentryClient, initializeSentryUser } from "./orchestrator/errors";
import { noThrow } from "./utils/control-flow";

function main() {
  const orchestrator = new UnoOrchestrator(Zone.Background);

  orchestrator.initialize().then(async () => {
    enableHotReload(orchestrator);
    await initializeSentryUser(orchestrator);
  });

  chrome.tabs.onUpdated.addListener(async (tabID, changeInfo) => {
    // Upon tab refresh and/or navigation...
    if (changeInfo.status === "loading") {
      await noThrow(() => {
        // Cleanup any layers that are considered "ephemeral" for this tab.
        return orchestrator.useAction(RemoveEphemeralLayersForTab)({ tabID });
      });
    }
  });

  chrome.tabs.onRemoved.addListener(async (tabID) => {
    await noThrow(() => {
      // Cleanup any state that was namespaced to any removed tabs.
      return orchestrator.useAction(ResetLayersForTab)({ tabID });
    });
  });

  chrome.runtime.onStartup.addListener(async () => {
    await noThrow(() => {
      // Remove all existing layers if the browser is closed/re-opened.
      return orchestrator.useAction(ResetAllLayers)();
    });
  });

  chrome.runtime.onInstalled.addListener(async function (details) {
    if (details.reason === "update") {
      await noThrow(async () => {
        // Only open "What's New?" page if the user has already onboarded.
        const { realSeedFromStorage } = await import("@/v1/state");
        if ((await realSeedFromStorage()) != null) {
          await orchestrator.useAction(OpenWhatsNew)();
        }
      });
    }
  });
}

/**
 * Reloads the extension runtime during development if a "reload" event is
 * received by the build server.
 */
function enableHotReload(orchestrator: UnoOrchestrator) {
  if (process.env.WATCH === "true") {
    const eventSource = new EventSource(`http://localhost:1234/reload`);
    console.log("[hot-reload] listening for changes...");
    eventSource.addEventListener("reload", async () => {
      console.log("[hot-reload] reloading...");
      orchestrator.events.emit("hot-reload");
      setTimeout(() => {
        chrome.runtime.reload();
      }, 1); // Give content-scripts a moment to call `window.location.reload`
    });
  }
}

initializeSentryClient(Zone.Background);
main();
