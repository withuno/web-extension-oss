import { v4 as uuidV4 } from "uuid";

import { Layer, LayerPosition, LayerSearchParams } from "@/v2/store/slices/layer.slice";
import { Path } from "@/v2/ui/paths";
import { countSearchParams, createSearchParams, URLSearchParamsInit } from "@/v2/ui/router";

import { Zone, UnoOrchestrator } from "../../orchestrator";

/**
 * We use `LAYER_INCREMENT` to prefix generated layer IDs. This allows our layer
 * renderer to position layers in the DOM in the order they were created.
 */
let LAYER_INCREMENT = 0;

export interface CreateLayerOptions extends LayerSearchParams {
  path: Path;
  searchParams?: URLSearchParamsInit;
  parentLayer?: Layer;
  position?: LayerPosition.AnyPosition;
}

export const CreateLayer = UnoOrchestrator.registerAction({
  id: "layers/create",
  zone: Zone.Content,
  concurrency: "mutate-layers",
  async execute(input: CreateLayerOptions): Promise<Layer> {
    const { orchestrator, store } = this.context;
    let newLayer: Layer | undefined;

    await store.setState((state) => {
      const layersForThisTab = [...(state.layers[orchestrator.runtimeInfo.tabID] || [])];

      // Enrich the new layer with search params (e.g.: "?hello=world")
      const searchParams = createSearchParams(input.searchParams);
      const pathWithSearchParams =
        countSearchParams(searchParams) > 0 ? `${input.path}?${createSearchParams(input.searchParams)}` : input.path;

      // Construct a reference to the parent layers, accounting for
      // nested sub-layers by concatenating parent layers IDs with ":".
      const { parentLayer } = input;
      const parentLayerRef = parentLayer?.parentLayer
        ? `${parentLayer.parentLayer}:${parentLayer.id}`
        : parentLayer
        ? parentLayer.id
        : undefined;

      if (LAYER_INCREMENT === 0) {
        // Set the base `LAYER_INCREMENT` if layers already exist in state.
        LAYER_INCREMENT = layersForThisTab.reduce((max, layer) => {
          const increment = Number(layer.id.split("/")[0]);
          return Math.max(max, increment);
        }, 1);
      }

      newLayer = {
        id: `${++LAYER_INCREMENT}/${orchestrator.runtimeInfo.frameID}/${uuidV4()}`,
        parentLayer: parentLayerRef,
        history: { entries: [pathWithSearchParams], index: 0 },
        position: input.position ?? ("auto" as const),
        focusStrategy: input.focusStrategy,
        lightbox: input.lightbox,
        keepAlive: input.keepAlive,
      };

      const nextLayers = {
        ...state.layers,
        [orchestrator.runtimeInfo.tabID]:
          input.focusStrategy === "auto" || input.focusStrategy == null
            ? // Prepend the new layer to automatically give it focus.
              [newLayer, ...layersForThisTab]
            : // Append the new layer to prevent automatic focus.
              [...layersForThisTab, newLayer],
      };

      return {
        ...state,
        layers: nextLayers,
      };
    });

    return newLayer!;
  },
});
