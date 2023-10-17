import { Layer } from "@/v2/store/slices/layer.slice";
import { History } from "@/v2/ui/router";
import { clamp } from "@/v2/utils/math";

import { SyncLayerHistory } from "./sync-history.action";
import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const SyncRedirectUpdate = UnoOrchestrator.registerAction({
  id: "layers/history/sync-redirect",
  zone: Zone.Content,
  async execute(input: { layer: Layer; update: History.State }): Promise<void> {
    const { orchestrator, store } = this.context;
    const currentHistory = (await store.getState()).layers[orchestrator.runtimeInfo.tabID]?.find(
      (layer) => layer.id === input.layer.id,
    )?.history;

    if (currentHistory) {
      const nextEntries = [...currentHistory.entries];

      nextEntries.splice(currentHistory.index + input.update.delta, 1, input.update.location);

      await orchestrator.useAction(SyncLayerHistory)({
        layer: input.layer,
        history: {
          entries: nextEntries,
          index: clamp(currentHistory.index + input.update.delta, 0, nextEntries.length - 1),
        },
      });
    }
  },
});
