import { FillableDataType } from "./autocomplete.types";
import { Zone, UnoOrchestrator } from "../../orchestrator";
import { Path } from "../../ui/paths";
import { CreateLayer } from "../layers/create-layer.action";
import { ViewAutocompleteHint } from "../product-hints/autocomplete-hint.action";

export const CreateAutocompleteChip = UnoOrchestrator.registerAction({
  id: "autocomplete/create-autocomplete-chip",
  zone: Zone.Content,
  concurrency: 1,
  async execute(input: {
    fillableDataType: FillableDataType;
    referenceElement: string;
    rawData: string[];
    maskedData: string[];
  }): Promise<void> {
    const { orchestrator, store } = this.context;
    const state = await store.getState();

    if (state.aiAssist.status === "running") {
      return;
    }

    const chipReference = document.querySelector(input.referenceElement);
    const existingChipID = chipReference?.getAttribute("data-uno-autocomplete-id");
    const existingChipLayer = state.layers[orchestrator.runtimeInfo.tabID]?.find((layer) => {
      return layer.id === existingChipID;
    });

    if (!existingChipLayer) {
      const parentLayer = await orchestrator.useAction(CreateLayer)({
        path: Path.AutocompleteChip,
        position: {
          referenceElement: input.referenceElement,
          placement: "overlay",
        },
        searchParams: {
          type: input.fillableDataType,
          rawData: input.rawData,
          maskedData: input.maskedData,
        },
      });

      await orchestrator.useAction(ViewAutocompleteHint)({
        parentLayer,
        position: {
          referenceElement: input.referenceElement,
          offset: 0,
          placement: "left",
        },
      });

      chipReference?.setAttribute("data-uno-autocomplete-id", parentLayer.id);
    }
  },
});
