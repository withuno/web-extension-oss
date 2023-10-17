import { isMatch } from "@/v2/ui/router";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { RemoveLayer } from "../layers/remove-layer.action";

export const CloseAllProductHints = UnoOrchestrator.registerAction({
  id: "product-hints/close-all",
  zone: Zone.Content,
  async execute(): Promise<void> {
    const { orchestrator, store } = this.context;
    const state = await store.getState();
    const layersForThisTab = [...(state.layers[orchestrator.runtimeInfo?.tabID] || [])];

    layersForThisTab.forEach((layer) => {
      const currentLocation = layer.history.entries[layer.history.index];
      if (isMatch(currentLocation, "/product-hint/:_*")) {
        orchestrator.useAction(RemoveLayer)({
          id: layer.id,
        });
      }
    });

    await orchestrator.useAction(CreateAnalyticsEvent)({
      type: "Close all product hints",
    });
  },
});
