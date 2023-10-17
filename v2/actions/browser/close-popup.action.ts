import { Zone, UnoOrchestrator } from "../../orchestrator";

export const ClosePopup = UnoOrchestrator.registerAction({
  id: "browser/close-popup",
  zone: Zone.Content,
  async execute(): Promise<void> {
    let windows = chrome.extension.getViews({ type: "popup" });
    if (windows.length) {
      windows[0]?.close();
    }
  },
});
