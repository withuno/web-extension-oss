import { LayerHistory } from "@/v2/store/slices/layer.slice";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const FocusLayer = UnoOrchestrator.registerAction({
  id: "layers/focus",
  zone: Zone.Content,
  concurrency: "mutate-layers",
  async execute(input: { id: string }): Promise<void> {
    const { orchestrator, store } = this.context;
    await store.setState((state) => {
      const layersForThisTab = [...(state.layers[orchestrator.runtimeInfo.tabID] || [])];

      const targetLayerIndex = layersForThisTab.findIndex((layer) => {
        return layer.id === input.id;
      });

      if (targetLayerIndex === 0) {
        // No update required; the target layer already has focus.
        return { ...state };
      }

      const targetLayer = layersForThisTab[targetLayerIndex];
      const targetLayerURL = targetLayer ? LayerHistory.getCurrentURL(targetLayer) : null;
      if (targetLayer?.focusStrategy === "disable" || targetLayerURL?.searchParams.get("focusStrategy") === "disable") {
        // No update required; the target layer should not receive focus by default.
        return { ...state };
      }

      const nextFocusedLayer = layersForThisTab.splice(targetLayerIndex, 1);
      const nextLayersForThisTab = [...nextFocusedLayer, ...layersForThisTab];

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
