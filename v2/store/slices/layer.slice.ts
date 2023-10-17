import type { Placement } from "@floating-ui/react";

export namespace LayerPosition {
  export interface Floating {
    referenceElement: string;
    root?: string;
    offset?:
      | number
      | {
          mainAxis?: number;
          crossAxis?: number;
          alignmentAxis?: number | null;
        };
    placement?: Placement;
  }

  export interface Overlay {
    referenceElement: string;
    root?: string;
    placement: "overlay";
    padding?: number;
  }

  export interface Coordinates {
    x?: number;
    y?: number;
  }

  export type Auto = "auto";

  export type AnyPosition = Floating | Overlay | Coordinates | Auto;

  export function isReferencePosition(pos?: Partial<AnyPosition>): pos is Floating | Overlay {
    if (!pos) return false;
    const anyPos = pos as any;
    return anyPos.referenceElement != null;
  }

  export function isFloatingReferencePosition(pos?: Partial<AnyPosition>): pos is Floating {
    if (!pos) return false;
    const anyPos = pos as any;
    return anyPos.referenceElement != null && anyPos.placement !== "overlay";
  }

  export function isOverlayReferencePosition(pos?: Partial<AnyPosition>): pos is Overlay {
    if (!pos) return false;
    const anyPos = pos as any;
    return anyPos.referenceElement != null && anyPos.placement === "overlay";
  }

  export function isCoordinatePosition(pos?: Partial<AnyPosition>): pos is Coordinates {
    if (!pos) return false;
    return !isReferencePosition(pos) && !isAutoPosition(pos);
  }

  export function isAutoPosition(pos?: Partial<AnyPosition>): pos is Auto {
    if (!pos) return false;
    const anyPos = pos as any;
    return anyPos === "auto";
  }

  export function getPositionType(pos?: Partial<AnyPosition>) {
    if (LayerPosition.isCoordinatePosition(pos)) return "coordinate";
    if (LayerPosition.isFloatingReferencePosition(pos)) return "floating";
    if (LayerPosition.isOverlayReferencePosition(pos)) return "overlay";
    return "auto";
  }

  export type PositionType = ReturnType<typeof getPositionType>;
}

export namespace LayerHistory {
  export function getCurrentURL(layer: Layer) {
    const historyEntry = layer.history.entries[layer.history.index];
    return typeof historyEntry === "string" ? new URL(historyEntry, "http://localhost") : historyEntry;
  }
}

export type FocusStrategy = "auto" | "disable";

export interface LayerSearchParams {
  lightbox?: boolean;
  keepAlive?: boolean;
  focusStrategy?: FocusStrategy;
}

export interface Layer extends LayerSearchParams {
  id: string;
  parentLayer?: string;
  history: {
    entries: Array<string | URL>;
    index: number;
  };
  position: LayerPosition.AnyPosition;
}

export interface LayerSlice {
  layers: {
    [tabID: number]: Layer[];
  };
}

export const initialLayerSlice: LayerSlice = {
  layers: {},
};
