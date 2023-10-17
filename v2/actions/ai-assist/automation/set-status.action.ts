import { Automation } from "@/v2/store/slices/ai-assist.slice";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";

import { AiAssistDispatchEvent } from "./dispatch-event.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";
import { CreateAnalyticsEvent } from "../../analytics/create-analytics-event.action";
import { AiAssistAnalytics } from "../ai-assist.analytics";

export const AiAssistSetStatus = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/set-status",
  zone: Zone.Content,
  async execute(input: Automation.Status): Promise<void> {
    const { orchestrator, store } = this.context;
    const state = await store.setState((state) => {
      return {
        aiAssist: { ...state.aiAssist, status: input },
      };
    });

    const currentTask = state.aiAssist;
    const currentObjective = state.aiAssist.objective!;
    const aiEnabled = state.settings.enabledFeatures.includes(FeatureFlag.AiAssist);

    await orchestrator.useAction(CreateAnalyticsEvent)(
      AiAssistAnalytics.StopAutomation({
        objective: currentObjective.name,
        aiEnabled,
      }),
    );

    switch (currentTask.status) {
      case "done/finish": {
        await orchestrator.useAction(CreateAnalyticsEvent)(
          AiAssistAnalytics.AutomationSuccess({
            objective: currentObjective.name,
            aiEnabled,
          }),
        );

        await orchestrator.useAction(AiAssistDispatchEvent)("onFinish");
        break;
      }

      case "error":
      case "done/fail": {
        await orchestrator.useAction(CreateAnalyticsEvent)(
          AiAssistAnalytics.AutomationFailed({
            objective: currentObjective.name,
            aiEnabled,
          }),
        );

        await orchestrator.useAction(AiAssistDispatchEvent)("onFail");
        break;
      }
    }
  },
});
