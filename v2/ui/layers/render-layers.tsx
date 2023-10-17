import { useMemo } from "react";

import { clsx } from "clsx";
import { AnimatePresence } from "framer-motion";

import { LayerHistory, LayerPosition } from "@/v2/store/slices/layer.slice";

import { LayerProvider } from "./layer-context";
import { useUnoOrchestrator } from "../../orchestrator/react";
import { useUnoStore } from "../../store";
import { UnoLayer, UnoLightbox } from "../components/uno-custom-elements";

/**
 * Renders all in-page layers as currently represented by global state.
 */
export function RenderLayers() {
  const { orchestrator } = useUnoOrchestrator();
  const layers = useUnoStore((state) => {
    return orchestrator.runtimeInfo?.tabID ? state.layers[orchestrator.runtimeInfo.tabID] : [];
  });

  const focusID = layers?.[0]?.id;
  let layerIndex = 0;

  // Filter `layers` which are intended only for this orchestrator's
  // `runtimeInfo.frameID`. This ensures that only layers that are intended
  // to be rendered in current document, which itself may be inside an `<iframe>`.
  const filteredLayers = useMemo(() => {
    return [...(layers || [])].filter((f) => {
      return Number(f.id.split("/")[1]) === orchestrator.runtimeInfo?.frameID;
    });
  }, [JSON.stringify(layers)]);

  // Sort `layers` alphabetically by `id` so we get a consistent/predictable
  // rendering order (TBH, I'm not sure why we're having an ordering problem
  // when component keys are unique, but alas... something isn't memoizing
  // correctly without this).
  const sortedLayers = useMemo(() => {
    return [...filteredLayers].sort((a, b) => {
      if (a.id < b.id) {
        return -1;
      }
      if (a.id > b.id) {
        return 1;
      }
      return 0;
    });
  }, [filteredLayers]);

  // Determine if this layer should be rendered with a lightbox overlay...
  const hasLightbox = useMemo(() => {
    return sortedLayers.some((layer) => {
      if (layer.lightbox) {
        return true;
      }
      const currentURL = LayerHistory.getCurrentURL(layer);
      return !!currentURL.searchParams.get("lightbox");
    });
  }, [sortedLayers]);

  return (
    <AnimatePresence mode="sync" initial={false}>
      <UnoLightbox
        className={clsx(
          "absolute left-0 top-0 block h-full w-full bg-black transition-opacity",
          hasLightbox ? "pointer-events-auto opacity-20" : "pointer-events-none opacity-0",
        )}
      />

      {sortedLayers?.map((layer) => {
        // If this layer is auto-positioned, we'll increment `layerIndex` so
        // that our positioning engine knows how far to offset the layer,
        // ensuring that multiple layers can remain visible & interactive
        // simultaneously.
        if (LayerPosition.isAutoPosition(layer.position)) {
          layerIndex++;
        }

        return (
          <UnoLayer
            key={layer.id}
            className="pointer-events-none relative"
            style={{ zIndex: focusID === layer.id ? "1" : "0" }}
          >
            <LayerProvider layer={layer} focusID={focusID} layerIndex={layerIndex} />
          </UnoLayer>
        );
      })}
    </AnimatePresence>
  );
}
