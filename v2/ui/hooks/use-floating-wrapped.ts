import { useRef, useCallback, useMemo, useEffect } from "react";

import {
  useFloating as useFloatingBase,
  offset,
  Placement,
  Middleware,
  type UseFloatingOptions as UseFloatingOptionsBase,
} from "@floating-ui/react";
import { useResizeObserver } from "usable-react";

import { useMutationObserver, MutationType } from "../components/mutation-observer";

export interface UseFloatingWrappedOptions extends Omit<Partial<UseFloatingOptionsBase>, "elements" | "placement"> {
  onReferenceElementDisconnect?: () => void;
  referenceElement?: Element | null;
  middleware?: Array<Middleware | null | undefined | false>;
  placement?: Placement | "overlay";
  overlayPadding?: number;
}

/**
 * Wraps `useFloating` from `@floating-ui/react` with the following additional functionality:
 *
 *   - Creates a "virtualized" reference element to preserve the shape and size
 *     of a floating element to ensure exit animations are un-interrupted if a
 *     reference element drastically changes or is removed from the DOM.
 *
 *   - Adds support for "overlay" placements, which span the full width and
 *     height of a reference element, centered.
 */
export function useFloatingWrapped(options: UseFloatingWrappedOptions) {
  const {
    onReferenceElementDisconnect,
    referenceElement = null,
    placement = "bottom",
    overlayPadding = 0,
    middleware = [],
    ...otherFloatingOptions
  } = options;

  // Create a virtualized reference element so we can retain a floating position
  // even if the reference node is removed. We'll end up removing the element if
  // the reference node is removed, but this enables an exit animation to play
  // without the floating element "jumping around".
  const virtualReferenceElement = useRef<any>(null);
  const saveVirtualBoundingClientRect = useCallback(() => {
    if (referenceElement?.isConnected) {
      const boundingClientRect = referenceElement?.getBoundingClientRect();
      virtualReferenceElement.current = {
        getBoundingClientRect: () => boundingClientRect,
      };
    }
  }, [referenceElement?.isConnected]);

  // Resolve the reference element's parent node.
  // We use this to detect if `referenceElement` is removed.
  const referenceElementParent = useMemo(() => {
    return referenceElement?.parentElement;
  }, [referenceElement]);

  // Initialize `virtualReferenceElement`...
  useEffect(() => {
    saveVirtualBoundingClientRect();
  }, []);

  // If the `referenceElementParent` is somehow disconnected from the DOM
  // between the previous and current render, then emit a close event.
  useEffect(() => {
    if (referenceElementParent?.isConnected === false) {
      onReferenceElementDisconnect?.();
    }
  }, [onReferenceElementDisconnect, referenceElementParent?.isConnected]);

  // If the `referenceElement` itself is somehow disconnected from the DOM
  // between the previous and current render (or... perhaps wasn't selectable
  // in the first place), then emit a close event.
  useEffect(() => {
    if (!referenceElement) {
      onReferenceElementDisconnect?.();
    }
  }, [onReferenceElementDisconnect, referenceElement]);

  // If the reference element is mutated in a way that updates it's position or
  // dimension, then update `virtualReferenceElement` with the latest DOM rect
  // info.
  useMutationObserver(referenceElement, {
    subtree: true,
    categories: [MutationType.Attributes, MutationType.CharacterData, MutationType.ChildList],
    onMutation: saveVirtualBoundingClientRect,
  });
  useResizeObserver(referenceElement, saveVirtualBoundingClientRect);

  // If the reference element is removed from the DOM, then emit a close event.
  useMutationObserver(referenceElementParent, {
    categories: [MutationType.ChildList],
    onChildRemoved: ({ child }) => {
      if (child === referenceElement) {
        onReferenceElementDisconnect?.();
      }
    },
  });

  // Start positioning the floating element.
  const floating = useFloatingBase({
    placement:
      placement === "overlay"
        ? "bottom" // default assumption for "overlay" position
        : placement,
    elements: {
      reference: referenceElement?.isConnected === true ? referenceElement : virtualReferenceElement.current,
    },
    middleware: [
      placement === "overlay" &&
        offset(({ rects }) => {
          // Centers floating element horizontally; assumes placement is "bottom"
          return -rects.reference.height / 2 - rects.floating.height / 2;
        }),
      ...middleware,
    ],
    ...otherFloatingOptions,
  });

  let { floatingStyles } = floating;
  if (placement === "overlay") {
    const { width, height } = virtualReferenceElement?.current
      ? virtualReferenceElement.current?.getBoundingClientRect() ?? {}
      : referenceElement?.getBoundingClientRect() ?? {};

    floatingStyles = {
      ...floating.floatingStyles,
      width: `${width + overlayPadding * 2}px`,
      height: `${height + overlayPadding * 2}px`,
    };
  }

  return { ...floating, floatingStyles };
}
