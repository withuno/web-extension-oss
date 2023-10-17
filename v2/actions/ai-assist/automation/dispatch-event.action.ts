import { Automation } from "@/v2/store/slices/ai-assist.slice";

import { AiAssistSetPhase } from "./set-phase.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const AiAssistDispatchEvent = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/dispatch-event",
  zone: Zone.Content,
  async execute<Evt extends Automation.Objective.EventName>(
    input: Evt,
  ): Promise<Automation.Objective.ExtractEventOutput<Evt> | undefined> {
    const { orchestrator, store } = this.context;
    const currentTask = (await store.getState()).aiAssist;
    if (currentTask.tabID === orchestrator.runtimeInfo.tabID && currentTask.objective) {
      await orchestrator.useAction(AiAssistSetPhase)(`event/${input}`);
      const eventAction = Automation.ObjectiveDefinition.getEventAction(input, currentTask.objective);
      if (eventAction) {
        return orchestrator.useAction(eventAction)(currentTask.objective.context) as Promise<
          Automation.Objective.ExtractEventOutput<Evt> | undefined
        >;
      }
    }
  },
});
