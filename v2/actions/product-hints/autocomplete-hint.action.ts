import { Layer, LayerPosition } from "@/v2/store/slices/layer.slice";
import { Path } from "@/v2/ui/paths";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { CreateLayer } from "../layers/create-layer.action";

export const ViewAutocompleteHint = UnoOrchestrator.registerAction({
  id: "product-hints/view-autocomplete-hint",
  zone: Zone.Background,
  concurrency: 1,
  async execute(input: { parentLayer: Layer; position: LayerPosition.Floating }): Promise<void> {
    const { orchestrator, store } = this.context;
    const { seenProductHints } = await store.getState();
    if (!seenProductHints.autocomplete) {
      await orchestrator.useAction(CreateAnalyticsEvent)({
        type: "Product hint viewed: autofill",
      });

      await orchestrator.useAction(CreateLayer)({
        path: Path.AutocompleteHint,
        position: input.position,
        parentLayer: input.parentLayer,
      });

      await store.setState((state) => {
        return {
          ...state,
          seenProductHints: {
            ...state.seenProductHints,
            autocomplete: true,
          },
        };
      });
    }
  },
});
