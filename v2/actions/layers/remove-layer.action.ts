import { Zone, UnoOrchestrator } from "../../orchestrator";

export const RemoveLayer = UnoOrchestrator.registerAction({
  id: "layers/remove",
  zone: Zone.Content,
  concurrency: "mutate-layers",
  async execute(input: { id: string }): Promise<void> {
    const { orchestrator, store } = this.context;
    await store.setState((state) => {
      const layersForThisTab = [...(state.layers[orchestrator.runtimeInfo.tabID] || [])];

      // Filter out layers that match the input ID or which
      // are parented to a layer that matches the input ID.
      const nextLayersForThisTab = layersForThisTab.filter((layer) => {
        return layer.id !== input.id && !layer.parentLayer?.split(":").includes(input.id);
      });

      const nextLayers = {
        ...state.layers,
        [orchestrator.runtimeInfo.tabID]: nextLayersForThisTab,
      };

      // If no more layers are left for this tab, remove the field entirely.
      if (!nextLayersForThisTab.length) {
        delete nextLayers[orchestrator.runtimeInfo.tabID];
      }

      return {
        ...state,
        layers: nextLayers,
      };
    });
  },
});
