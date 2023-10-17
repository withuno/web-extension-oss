import { AiAssistSetStatus } from "./set-status.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const AiAssistInterruptAutomation = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/interrupt-automation",
  zone: Zone.Background,
  async execute(): Promise<void> {
    const { orchestrator, store } = this.context;
    const currentStatus = (await store.getState()).aiAssist.status;
    if (["idle", "running"].includes(currentStatus)) {
      await orchestrator.useAction(AiAssistSetStatus)("interrupted");
    }
  },
});
