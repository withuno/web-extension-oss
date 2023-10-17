import { Zone, UnoOrchestrator } from "../../../orchestrator";
import type { Layer } from "../../../store/slices/layer.slice";

export const SyncLayerHistory = UnoOrchestrator.registerAction({
  id: "layers/history/sync-history",
  zone: Zone.Content,
  concurrency: "mutate-layers",
  async execute(input: { layer: Layer; history: Layer["history"] }): Promise<void> {
    const { orchestrator, store } = this.context;
    await store.setState((state) => {
      const layersForThisTab = [...(state.layers[orchestrator.runtimeInfo.tabID] || [])];

      const targetLayerID = layersForThisTab.findIndex((layer) => {
        return layer.id === input.layer.id;
      });

      const replacementLayer = {
        ...layersForThisTab[targetLayerID],
        history: input.history,
      };

      const nextLayersForThisTab = [...layersForThisTab];
      nextLayersForThisTab.splice(targetLayerID, 1, replacementLayer);

      const nextLayers = {
        ...state.layers,
        [orchestrator.runtimeInfo.tabID]: nextLayersForThisTab,
      };

      return {
        ...state,
        layers: nextLayers,
      };
    });
  },
});
