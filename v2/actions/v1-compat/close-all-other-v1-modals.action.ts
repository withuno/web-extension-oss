import type { ExtensionContext } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const CloseAllOtherV1Modals = UnoOrchestrator.registerAction({
  id: "close-all-other-v1-modals",
  zone: Zone.Content,
  async execute(input: { v1ExtensionContext?: ExtensionContext | null }): Promise<void> {
    const { store } = this.context;
    const v1ExtensionContext = input.v1ExtensionContext ?? (await store.getState()).v1.extensionContext;

    if (!v1ExtensionContext) {
      return;
    }

    const { closeAllOtherModals } = await import("@/v1/content/content_script");
    try {
      closeAllOtherModals(v1ExtensionContext);
    } catch {
      /* Swallow errors here... */
    }
  },
});
