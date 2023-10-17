import { Automation } from "@/v2/store/slices/ai-assist.slice";

import { AiAssistSetPhase } from "./set-phase.action";
import { AiAssistSetStatus } from "./set-status.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const AiAssistExecuteEffect = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/execute-effect",
  zone: Zone.Content,
  async execute(input: Automation.Effect): Promise<void> {
    const { orchestrator, store } = this.context;

    const currentTask = (await store.getState()).aiAssist;
    if (currentTask.status === "running" && currentTask.tabID === orchestrator.runtimeInfo.tabID) {
      const effectAction = Automation.AbilityDefinition.getEffectAction(input);
      if (effectAction) {
        try {
          await orchestrator.useAction(AiAssistSetPhase)("performing-action");

          await store.setState((state) => {
            return {
              aiAssist: {
                ...state.aiAssist,
                history: [...state.aiAssist.history, input],
              },
            };
          });

          await orchestrator.useAction(effectAction)({
            ...input.payload.parameters,
            ...(currentTask.objective?.context ?? {}),
          });
        } catch {
          await orchestrator.useAction(AiAssistSetStatus)("error");
        }
      } else {
        // Reaching the default case here means we received an unknown effect name...
        // (this case should not be possible unless we've made a developer error)
        await orchestrator.useAction(AiAssistSetStatus)("error");
      }
    }
  },
});
