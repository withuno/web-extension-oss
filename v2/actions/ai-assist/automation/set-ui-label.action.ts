import { Automation } from "@/v2/store/slices/ai-assist.slice";

import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const AiAssistSetUILabel = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/set-ui-label",
  zone: Zone.Content,
  async execute(input: Partial<Automation.UILabel>): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      return {
        aiAssist: {
          ...state.aiAssist,
          uiLabel: {
            ...state.aiAssist.uiLabel,
            ...input,
          },
        },
      };
    });
  },
});
