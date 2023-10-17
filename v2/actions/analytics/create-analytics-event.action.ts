import { AnalyticsEvent } from "./analytics.types";
import { segment } from "./segment";
import { Zone, UnoOrchestrator } from "../../orchestrator";

export const CreateAnalyticsEvent = UnoOrchestrator.registerAction({
  id: "analytics/create-analytics-event",
  zone: Zone.Background,
  async execute(input: AnalyticsEvent.Type): Promise<void> {
    await segment.track(input.type, input.properties);
  },
});
