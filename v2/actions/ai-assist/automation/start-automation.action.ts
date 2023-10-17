import { Automation } from "@/v2/store/slices/ai-assist.slice";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";

import { AiAssistDispatchEvent } from "./dispatch-event.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";
import { CreateAnalyticsEvent } from "../../analytics/create-analytics-event.action";
import { AiAssistAnalytics } from "../ai-assist.analytics";

export const AiAssistStartAutomation = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/start-automation",
  zone: Zone.Content,
  async execute(input: Automation.Objective.Type): Promise<void> {
    const { orchestrator, store } = this.context;
    const aiEnabled = (await store.getState()).settings.enabledFeatures.includes(FeatureFlag.AiAssist);

    await orchestrator.useAction(CreateAnalyticsEvent)(
      AiAssistAnalytics.StartAutomation({
        objective: input.name,
        aiEnabled,
      }),
    );

    await store.setState((state) => {
      return {
        aiAssist: {
          ...state.aiAssist,
          tabID: orchestrator.runtimeInfo.tabID,
          objective: input,
          history: [],
          status: "running",
          phase: "idle",
          uiLabel: {
            title: "AI Assist...",
            theme: "neutral",
          },
        },
      };
    });

    const userPrompt = await orchestrator.useAction(AiAssistDispatchEvent)("onStart");

    // Set the user prompt
    await store.setState((state) => {
      if (state.aiAssist.objective) {
        return {
          aiAssist: {
            ...state.aiAssist,
            objective: { ...state.aiAssist.objective, prompt: userPrompt },
          },
        };
      }
      return state;
    });
  },
});
