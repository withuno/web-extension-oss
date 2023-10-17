import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef } from "react";

import { FloatingContext, arrow, autoUpdate, flip, offset, shift } from "@floating-ui/react";
import { clsx } from "clsx";
import { useCallbackConst, useConst } from "usable-react";

import { FocusLayer } from "@/v2/actions/layers/focus-layer.action";
import { RemoveLayer } from "@/v2/actions/layers/remove-layer.action";
import { HotkeyBoundary } from "@/v2/orchestrator/hotkeys";
import { useUnoStore } from "@/v2/store";
import { mergeRefs } from "@/v2/utils/react-refs";

import { LayerRouter } from "./layer-router";
import { useUnoOrchestrator } from "../../orchestrator/react";
import { Layer, LayerPosition } from "../../store/slices/layer.slice";
import { UnoLayerBody } from "../components/uno-custom-elements";
import { useActiveElement } from "../hooks/use-active-element";
import { useIsDemoHost } from "../hooks/use-demo-host";
import { useFloatingWrapped } from "../hooks/use-floating-wrapped";
import { useQuerySelector } from "../hooks/use-query-selector";
import { WithChildren } from "../prop.types";
import { createMemoryHistory } from "../router";

// --- Contextual layer data & hooks ---------------------------------------- //

export interface LayerContext {
  layer: Layer;
  focus: {
    isFocused: boolean;
    childIsFocused: boolean;
    parentIsFocused: boolean;
  };
  reference: PositionalData["reference"];
}

const LayerContext = createContext<LayerContext | null>(null);

/**
 * Use the layer context wrapping this React tree.
 */
export function useLayer() {
  return useContext(LayerContext)!.layer;
}

/**
 * @returns a memoized callback that dispatches the `RemoveModal` action for the
 * current layer.
 */
export function useCloseLayer() {
  const layer = useLayer();
  const { orchestrator } = useUnoOrchestrator();
  return useCallback(async () => {
    await orchestrator.useAction(RemoveLayer)({ id: layer.id });
  }, [layer.id]);
}

/**
 * @returns contextual focus state for this layer.
 */
export function useLayerFocus() {
  return useContext(LayerContext)!.focus;
}

/**
 * @returns contextual arrow data for this layer (applicable if positioned by
 * reference to another element).
 */
export function useFloatingLayerArrow() {
  const ctx = useContext(LayerContext)!.reference;
  return ctx.context ? { ref: ctx.arrowRef, context: ctx.context } : null;
}

/**
 * @returns the contextual reference element for this layer (applicable if
 * positioned by reference to another element).
 */
export function useFloatingLayerReferenceElement<El extends Element>() {
  return useContext(LayerContext)!.reference.referenceElement as El | null;
}

/**
 * @returns A callback function which schedules an update to the layer's
 * positioning system (applicable if positioned by reference to another
 * element).
 */
export function useFloatingLayerUpdatePosition() {
  return useContext(LayerContext)!.reference.context?.update ?? (() => {});
}

/**
 * @returns A boolean indicating whether the current layer is "positioned". This
 * will always be `true` for coordinate or "auto"-positioned layers, but will be
 * `false` on the initial render for layers positioned by reference to another
 * element.
 */
export function useFloatingLayerIsPositioned() {
  const floatingContext = useContext(LayerContext)!.reference.context;
  return floatingContext?.isPositioned !== false;
}

// --- LayerProvider (routing, animation, positioning, etc.) ---------------- //

export interface LayerProviderProps extends WithChildren {
  layer: Layer;
  focusID: string;
  layerIndex: number;
}

/**
 * Provides stateful routing for the current layer.
 */
export function LayerProvider(props: LayerProviderProps) {
  const { layer, focusID, layerIndex } = props;

  const { orchestrator, layerRoutes } = useUnoOrchestrator();

  // --- Routing history / routes --- //
  const history = useConst(() => {
    return createMemoryHistory({
      initialEntries: layer.history.entries,
      initialIndex: layer.history.index,
    });
  });

  // --- Layer focus --- //
  const ref = useRef<HTMLDivElement | null>(null);
  const activeElement = useActiveElement();
  const focusLayer = useCallback(async () => {
    await orchestrator.useAction(FocusLayer)({ id: layer.id });
  }, [layer.id]);

  const childLayers = useUnoStore((state) => {
    const layersForThisTab = orchestrator.runtimeInfo?.tabID ? state.layers[orchestrator.runtimeInfo.tabID] : [];
    return layersForThisTab?.filter((f) => {
      return f.parentLayer?.split(":").includes(layer.id);
    });
  });

  const layerIsFocused = focusID === layer.id;
  const childLayerIsFocused = useMemo(() => {
    return childLayers?.some((f) => f.id === focusID);
  }, [childLayers, focusID]);
  const parentLayerIsFocused = useMemo(() => {
    return layer.parentLayer != null && layer.parentLayer?.split(":").includes(focusID);
  }, [focusID]);

  // Check if the active element is descendent.
  // If so, then set this layer as "focused".
  useLayoutEffect(() => {
    if (!layerIsFocused) {
      if (ref.current && activeElement && ref.current.contains(activeElement)) {
        focusLayer();
      }
    }
  }, [activeElement]);

  // --- Layer positioning --- //
  const pos = usePosition(layer, layerIndex);

  // --- Layer context --- //
  const ctx = useMemo<LayerContext>(() => {
    return {
      layer,
      focus: {
        isFocused: layerIsFocused,
        childIsFocused: childLayerIsFocused,
        parentIsFocused: parentLayerIsFocused,
      },
      reference: {
        arrowRef: pos.reference.context ? pos.reference.arrowRef : { current: null },
        context: pos.reference.context,
        referenceElement: pos.reference.referenceElement,
      },
    };
  }, [
    layer,
    layerIsFocused,
    childLayerIsFocused,
    parentLayerIsFocused,
    pos.reference.arrowRef,
    pos.reference.context,
    pos.reference.referenceElement,
  ]);

  return (
    <LayerContext.Provider value={ctx}>
      <UnoLayerBody
        data-uno-layer-id={layer.id}
        className={clsx("absolute", pos.reference.context?.isPositioned === false ? "invisible" : "visible")}
        style={pos.container.style}
        onPointerDown={focusLayer}
        onPointerEnter={focusLayer}
        ref={mergeRefs<HTMLDivElement>(ref, pos.container.ref)}
      >
        <HotkeyBoundary className="h-full w-full" scope={layer.id}>
          <LayerRouter layer={layer} history={history} routes={layerRoutes} />
        </HotkeyBoundary>
      </UnoLayerBody>
    </LayerContext.Provider>
  );
}

// --- Positioning engine --------------------------------------------------- //

interface PositionalData {
  type: LayerPosition.PositionType;
  container: {
    ref: ((node: HTMLElement | null) => void) | React.MutableRefObject<null>;
    style?: React.CSSProperties;
  };
  reference: {
    arrowRef: React.MutableRefObject<SVGSVGElement | null>;
    context: FloatingContext | null;
    referenceElement: Element | null;
  };
}

/**
 * @returns a `PositionalData` with all the contextual information required
 * to render a coordinate-positioned or floating-positioned layer.
 */
function usePosition(layer: Layer, layerIndex: number): PositionalData {
  const positionType = useConst(() => {
    return LayerPosition.getPositionType(layer.position);
  });

  const defaultPositionContext: PositionalData = useConst(() => ({
    type: positionType,
    container: { ref: { current: null }, style: undefined },
    reference: {
      arrowRef: { current: null },
      context: null,
      referenceElement: null,
    },
  }));

  // This conditional breaks the rules of hooks, which is okay to do here
  // because we guarantee `layer.pos` will not change between position types
  // throughout the lifecycle of the layer.
  switch (positionType) {
    case "coordinate": {
      return { ...defaultPositionContext, ...useCoordinatePosition(layer) };
    }
    case "floating":
    case "overlay": {
      return { ...defaultPositionContext, ...useReferencePosition(layer) };
    }
    case "auto":
    default: {
      return { ...defaultPositionContext, ...useAutoPosition(layerIndex) };
    }
  }
}

/**
 * @returns style attributes if `layer` should be positioned/stacked
 * automatically.
 */
function useAutoPosition(layerIndex: number): Partial<PositionalData> {
  const isDemoHost = useIsDemoHost();
  const xOffset = isDemoHost
    ? useCoordinatePosition.DEMO_COORDINATE_OFFSET_X
    : useCoordinatePosition.DEFAULT_COORDINATE_OFFSET_X;
  const yOffset = isDemoHost
    ? useCoordinatePosition.DEMO_COORDINATE_OFFSET_Y
    : useCoordinatePosition.DEFAULT_COORDINATE_OFFSET_Y;

  const xNormalized = layerIndex * xOffset;
  const yNormalized = layerIndex * yOffset;

  return {
    container: {
      ref: { current: null },
      style: {
        position: "absolute",
        transform: `translate(${xNormalized}px, ${yNormalized}px)`,
        transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  };
}

/**
 * @returns style attributes if `layer` should be positioned using x/y
 * coordinates.
 */
function useCoordinatePosition(layer: Layer): Partial<PositionalData> {
  const { x, y } = layer.position as LayerPosition.Coordinates;

  const isDemoHost = useIsDemoHost();
  const xOffset = isDemoHost
    ? useCoordinatePosition.DEMO_COORDINATE_OFFSET_X
    : useCoordinatePosition.DEFAULT_COORDINATE_OFFSET_X;
  const yOffset = isDemoHost
    ? useCoordinatePosition.DEMO_COORDINATE_OFFSET_Y
    : useCoordinatePosition.DEFAULT_COORDINATE_OFFSET_Y;

  const xNormalized = x ?? xOffset;
  const yNormalized = y ?? yOffset;

  return {
    container: {
      ref: { current: null },
      style: {
        position: "absolute",
        transform: `translate(${xNormalized}px, ${yNormalized}px)`,
        transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  };
}

useCoordinatePosition.DEFAULT_COORDINATE_OFFSET_X = 24;
useCoordinatePosition.DEFAULT_COORDINATE_OFFSET_Y = 24;
useCoordinatePosition.DEMO_COORDINATE_OFFSET_X = 40;
useCoordinatePosition.DEMO_COORDINATE_OFFSET_Y = 134;

/**
 * @returns refs, style attributes, and contextual arrow data for layers
 * positioned by reference to another element.
 */
function useReferencePosition(layer: Layer): Partial<PositionalData> {
  const pos = layer.position as LayerPosition.Floating | LayerPosition.Overlay;

  const { orchestrator } = useUnoOrchestrator();
  const close = useCallbackConst(async () => {
    await orchestrator.useAction(RemoveLayer)({ id: layer.id });
  });

  const referenceElement = useQuerySelector(pos.referenceElement, pos.root);
  const arrowRef = useRef<SVGSVGElement | null>(null);

  const { refs, floatingStyles, context } = useFloatingWrapped({
    referenceElement,
    onReferenceElementDisconnect: close,
    placement: pos.placement,
    overlayPadding: LayerPosition.isOverlayReferencePosition(pos) ? pos?.padding : undefined,
    middleware: [
      !LayerPosition.isOverlayReferencePosition(pos) && offset(pos?.offset ?? 10),
      flip(),
      shift(),
      arrow({
        element: arrowRef,
        padding: 25, // Set minimum arrow padding; defaults to border radius of containing elements.
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  return {
    container: { ref: refs.setFloating, style: floatingStyles },
    reference: { arrowRef, referenceElement, context },
  };
}
