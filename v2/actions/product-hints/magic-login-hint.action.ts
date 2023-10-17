import { Layer } from "@/v2/store/slices/layer.slice";
import { Path } from "@/v2/ui/paths";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { CreateLayer } from "../layers/create-layer.action";

export const ViewMagicLoginHint = UnoOrchestrator.registerAction({
  id: "product-hints/view-magic-login-hint",
  zone: Zone.Background,
  async execute(input: Layer): Promise<void> {
    const { orchestrator, store } = this.context;
    const { seenProductHints } = await store.getState();
    if (!seenProductHints.magicLogin) {
      await orchestrator.useAction(CreateAnalyticsEvent)({
        type: "Product hint viewed: magic login",
      });

      await orchestrator.useAction(CreateLayer)({
        path: Path.MagicLoginHint,
        parentLayer: input,
        position: {
          referenceElement: `[data-uno-layer-id="${input.id}"]`,
          offset: 20,
          placement: "right",
        },
      });

      await store.setState((state) => {
        return {
          ...state,
          seenProductHints: {
            ...state.seenProductHints,
            magicLogin: true,
          },
        };
      });
    }
  },
});
