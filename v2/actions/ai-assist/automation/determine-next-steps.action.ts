import { Automation } from "@/v2/store/slices/ai-assist.slice";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { truthyFilter } from "@/v2/types/type-guards";
import { ensureArray } from "@/v2/utils/arrays";

import { AskAiAction } from "./ask-ai.action";
import { AiAssistDispatchEvent } from "./dispatch-event.action";
import { AiAssistSetPhase } from "./set-phase.action";
import { AiAssistSetStatus } from "./set-status.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";
import { CreateAnalyticsEvent } from "../../analytics/create-analytics-event.action";
import { AiAssistAnalytics } from "../ai-assist.analytics";
import { GetSimplifiedDOM } from "../dom/get-simplified-dom.action";

export const AiAssistDetermineNextSteps = UnoOrchestrator.registerAction({
  id: "ai-assist/automation/determine-next-steps",
  zone: Zone.Content,
  async execute(): Promise<Automation.Effect[]> {
    const { orchestrator, store } = this.context;

    const shouldStop = async () => {
      const currentTask = (await store.getState()).aiAssist;
      return currentTask.status !== "running" || orchestrator.runtimeInfo.tabID !== currentTask.tabID;
    };

    try {
      // ------------------------------------------------------------------ //
      // 1. Check if we should stop taking further actions off-the-bat.

      if (await shouldStop()) {
        return [];
      }

      // ------------------------------------------------------------------ //
      // 2. Check to make sure the AI agent hasn't become stuck in a loop.

      let state = await store.getState();
      let currentTask = state.aiAssist;
      let currentObjective = currentTask.objective!;

      const duplicatesThreshold = 3; // The number of exact, repeated effects to permit before we bail out...
      const recentEffects = state.aiAssist.history.slice(duplicatesThreshold * -1).filter(truthyFilter);

      const isProbablyStuckInALoop =
        recentEffects.length === duplicatesThreshold &&
        recentEffects.every(({ effect }, i, arr) => {
          return effect === arr[0].effect;
        });

      if (isProbablyStuckInALoop) {
        const aiEnabled = state.settings.enabledFeatures.includes(FeatureFlag.AiAssist);
        await orchestrator.useAction(CreateAnalyticsEvent)(
          AiAssistAnalytics.LoopDetectionEngaged({
            objective: currentObjective.name,
            aiEnabled,
          }),
        );
        await orchestrator.useAction(AiAssistSetStatus)("error");
        return [];
      }

      if (await shouldStop()) {
        return [];
      }

      // ------------------------------------------------------------------ //
      // 3. Pull simplified DOM.

      await orchestrator.useAction(AiAssistSetPhase)("pulling-dom");

      const { html } = await orchestrator.useAction(GetSimplifiedDOM)();
      if (!html) {
        await orchestrator.useAction(AiAssistSetStatus)("error");
        return [];
      }

      if (await shouldStop()) {
        return [];
      }

      // ------------------------------------------------------------------ //
      // 4. Dispatch "onDetermineNextSteps" event; potential early-return via
      //    synthetic effects gleaned from "onDetermineNextSteps" or if a
      //    workflow failure is indicated.

      state = await store.getState();
      currentTask = state.aiAssist;
      currentObjective = currentTask.objective!;

      const syntheticEffects = await orchestrator.useAction(AiAssistDispatchEvent)("onDetermineNextSteps");

      if (typeof syntheticEffects === "boolean") {
        if (!syntheticEffects) {
          await orchestrator.useAction(AiAssistSetStatus)("error");
          return [];
        }
      } else if (syntheticEffects != null) {
        return ensureArray(syntheticEffects);
      }

      if (await shouldStop()) {
        return [];
      }

      // ------------------------------------------------------------------ //
      // 5. Dispatch "onCheckEnabledAbilities" event, then ask our AI agent
      //    for the next set of instructions.

      state = await store.getState();
      currentTask = state.aiAssist;
      currentObjective = currentTask.objective!;

      if (!currentObjective.prompt) {
        console.error(`User prompt not configured for objective: "${currentObjective.name}"`);
        await orchestrator.useAction(AiAssistSetStatus)("error");
        return [];
      }

      const aiEnabled = state.settings.enabledFeatures.includes(FeatureFlag.AiAssist);

      if (aiEnabled) {
        await orchestrator.useAction(CreateAnalyticsEvent)(
          AiAssistAnalytics.AiAgentEngaged({
            objective: currentObjective.name,
            aiEnabled,
          }),
        );

        await orchestrator.useAction(AiAssistSetPhase)("performing-query");

        const completion = await orchestrator.useAction(AskAiAction)({
          html,
          objective: {
            ...currentObjective,
            abilities:
              (await orchestrator.useAction(AiAssistDispatchEvent)("onCheckEnabledAbilities")) ??
              currentObjective.abilities,
          },
          history: (await store.getState()).aiAssist.history.filter(truthyFilter),
        });

        if (!completion) {
          await orchestrator.useAction(AiAssistSetStatus)("error");
          return [];
        }

        if ("error" in completion.response) {
          await orchestrator.useAction(AiAssistSetStatus)("error");
          return [];
        }

        return completion.response.entries;
      }
      // If the user's disabled AI via settings, then we'll wrap up the flow...
      await orchestrator.useAction(AiAssistSetStatus)("done/finish");
      return [];
    } catch {
      await orchestrator.useAction(AiAssistSetStatus)("error");
      return [];
    }
  },
});
