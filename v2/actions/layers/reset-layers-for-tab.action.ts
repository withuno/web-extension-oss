import { Zone, UnoOrchestrator } from "../../orchestrator";

export const ResetLayersForTab = UnoOrchestrator.registerAction({
  id: "layers/reset-for-tab",
  zone: Zone.Background,
  concurrency: "mutate-layers",
  async execute(input: { tabID: number }): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      const nextLayers = { ...state.layers };
      delete nextLayers[input.tabID];
      return {
        ...state,
        layers: nextLayers,
      };
    });
  },
});
