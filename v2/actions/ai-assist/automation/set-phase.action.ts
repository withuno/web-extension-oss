import { Automation } from "@/v2/store/slices/ai-assist.slice";

import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const AiAssistSetPhase = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/set-phase",
  zone: Zone.Content,
  async execute(input: Automation.Phase): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      return {
        aiAssist: { ...state.aiAssist, phase: input },
      };
    });
  },
});
