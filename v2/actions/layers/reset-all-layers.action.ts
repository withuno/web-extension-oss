import { initialRootState } from "@/v2/store/root-state";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const ResetAllLayers = UnoOrchestrator.registerAction({
  id: "layers/reset-all",
  zone: Zone.Background,
  concurrency: "mutate-layers",
  async execute(): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      return {
        ...state,
        layers: { ...initialRootState.layers },
      };
    });
  },
});
