import { AnalyticsEvent } from "../analytics/analytics.types";

export namespace AiAssistAnalytics {
  export interface AutomationEventContext {
    objective: string;
    aiEnabled?: boolean;
  }

  export const StartAutomation = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: automation started");

  export const StopAutomation = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: automation stopped");

  export const AutomationSuccess = AnalyticsEvent.define<AutomationEventContext>(
    "AI Assist V2: automation completed successfully",
  );

  export const AutomationFailed = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: automation failed");

  export const AiAgentEngaged = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: automation used AI agent");

  export const LoopDetectionEngaged = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: loop detected");

  export namespace ConsentScreen {
    export const Accept = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: consent: accept");

    export const NotNow = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: consent: not now");

    export const Decline = AnalyticsEvent.define<AutomationEventContext>("AI Assist V2: consent: decline");
  }
}
