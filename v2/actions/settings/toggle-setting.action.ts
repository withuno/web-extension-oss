import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { ensureArray } from "@/v2/utils/arrays";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const ToggleSetting = UnoOrchestrator.registerAction({
  id: "settings/toggle",
  zone: Zone.Background,
  async execute(input: FeatureFlag | FeatureFlag[]): Promise<void> {
    const { store } = this.context;
    await store.setState((state) => {
      const enabledFeatures = new Set([...state.settings.enabledFeatures]);
      for (const toggleFeature of ensureArray(input)) {
        if (enabledFeatures.has(toggleFeature)) {
          enabledFeatures.delete(toggleFeature);
        } else {
          enabledFeatures.add(toggleFeature);
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
