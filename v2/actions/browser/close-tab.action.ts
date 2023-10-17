import { Zone, UnoOrchestrator } from "../../orchestrator";

export const CloseTab = UnoOrchestrator.registerAction({
  id: "browser/close-tab",
  zone: Zone.Background,
  async execute(input: { tabID: number | null }): Promise<void> {
    const { tabID } = input;
    if (tabID != null) {
      await new Promise((resolve) => {
        chrome.tabs.remove(tabID, resolve);
      });
    }
  },
});
