import type { ExtensionContext } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const OpenFeedbackModal = UnoOrchestrator.registerAction({
  id: "open-feedback-modal",
  zone: Zone.Content,
  async execute(input?: { customFeedback?: string; v1ExtensionContext?: ExtensionContext | null }): Promise<void> {
    const { store } = this.context;
    const v1ExtensionContext = input?.v1ExtensionContext ?? (await store.getState()).v1.extensionContext;

    if (!v1ExtensionContext) {
      return;
    }

    const { showFeedbackModal } = await import("@/v1/content/content_script");
    await showFeedbackModal(v1ExtensionContext, input?.customFeedback);
  },
});
