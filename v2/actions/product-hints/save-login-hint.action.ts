import { LayerPosition } from "@/v2/store/slices/layer.slice";
import { Path } from "@/v2/ui/paths";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { CreateLayer } from "../layers/create-layer.action";

export const ViewSaveLoginHint = UnoOrchestrator.registerAction({
  id: "product-hints/view-save-login-hint",
  zone: Zone.Background,
  async execute(input: LayerPosition.Floating): Promise<void> {
    const { orchestrator, store } = this.context;
    const { seenProductHints } = await store.getState();
    if (!seenProductHints.saveLogin) {
      await orchestrator.useAction(CreateAnalyticsEvent)({
        type: "Product hint viewed: save login",
      });

      await orchestrator.useAction(CreateLayer)({
        path: Path.SaveLoginHint,
        position: input,
      });

      await store.setState((state) => {
        return {
          ...state,
          seenProductHints: {
            ...state.seenProductHints,
            saveLogin: true,
          },
        };
      });
    }
  },
});
