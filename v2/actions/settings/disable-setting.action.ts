import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { ensureArray } from "@/v2/utils/arrays";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const DisableSetting = UnoOrchestrator.registerAction({
  id: "settings/disable",
  zone: Zone.Background,
  async execute(input: FeatureFlag | FeatureFlag[]): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      const enabledFeatures = new Set([...state.settings.enabledFeatures]);
      for (const newFeature of ensureArray(input)) {
        if (enabledFeatures.has(newFeature)) {
          enabledFeatures.delete(newFeature);
        }
      }
      return {
        ...state,
        settings: {
          enabledFeatures: [...enabledFeatures],
        },
      };
    });
  },
});
