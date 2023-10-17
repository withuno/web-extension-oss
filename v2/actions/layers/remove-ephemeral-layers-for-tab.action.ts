import { LayerHistory } from "@/v2/store/slices/layer.slice";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const RemoveEphemeralLayersForTab = UnoOrchestrator.registerAction({
  id: "layers/remove-ephemeral-for-tab",
  zone: Zone.Background,
  concurrency: "mutate-layers",
  async execute(input: { tabID: number }): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      const layersForThisTab = [...(state.layers[input.tabID] || [])];

      // Filter out layers with `{ keepAlive: false }`
      const nextLayersForThisTab = layersForThisTab.filter((layer) => {
        if (layer.keepAlive) {
          return layer.keepAlive;
        }
        const currentURL = LayerHistory.getCurrentURL(layer);
        return currentURL.searchParams.has("keepAlive");
      });

      const nextLayers = {
        ...state.layers,
        [input.tabID]: nextLayersForThisTab,
      };

      // If no more layers are left for this tab, remove the field entirely.
      if (!nextLayersForThisTab.length) {
        delete nextLayers[input.tabID];
      }

      return {
        ...state,
        layers: nextLayers,
      };
    });
  },
});
