import { useState, useRef, useEffect } from "react";

import { clsx } from "clsx";
import { camelCase } from "lodash";
import { useIsMounted, useResizeObserver, useCallbackConst } from "usable-react";

import { throttleAnimationFrame } from "@/v2/utils/async";

import css from "./scroll-view.module.css";
import { Styleable, WithChildren } from "../../prop.types";
import { useMutationObserver } from "../mutation-observer";

export namespace ScrollView {
  export type Edge = "top" | "bottom" | "left" | "right";

  export type Direction = "x" | "y";

  export interface Props extends WithChildren, Styleable {
    direction?: ScrollView.Direction;
    disabled?: boolean;
    onScrollEdgeChange?: (edges: ScrollView.Edge[]) => void;
    shadows?: boolean;
  }
}

export function ScrollView(props: ScrollView.Props) {
  const { direction = "y", disabled, onScrollEdgeChange, shadows = true, children, className, style } = props;

  const [visibleShadows, setVisibleShadows] = useState<ScrollView.Edge[]>([]);
  const isMounted = useIsMounted();

  const elementRef = useRef<HTMLDivElement | null>(null);
  const directionRef = useRef<ScrollView.Direction>(direction);
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  const calculateShadows = useCallbackConst(
    throttleAnimationFrame(() => {
      if (elementRef.current) {
        const { scrollHeight, offsetWidth, scrollTop, scrollWidth, scrollLeft, offsetHeight } = elementRef.current;

        const edges: ScrollView.Edge[] = [];

        // ".top" or ".top_bottom" or ".bottom"
        if (directionRef.current === "y") {
          if (scrollTop > 0) edges.push("top");
          if (Math.ceil(scrollTop + offsetHeight) < scrollHeight) edges.push("bottom");
        }

        // ".left" or ".left_right" or ".right"
        if (directionRef.current === "x") {
          if (scrollLeft > 0) edges.push("left");
          if (Math.ceil(scrollLeft + offsetWidth) < scrollWidth) edges.push("right");
        }

        if (isMounted()) {
          setVisibleShadows(edges);
        }
      }
    }),
  );

  // Update consumers with changes to `<ScrollView>` shadow state.
  useEffect(() => {
    onScrollEdgeChange?.(visibleShadows);
  }, [visibleShadows]);

  // Calculate shadows upon resize or recursive DOM mutation.
  useResizeObserver(elementRef, calculateShadows);
  useMutationObserver(elementRef, {
    subtree: true,
    onMutation: calculateShadows,
  });

  return (
    <div
      className={clsx(
        className,
        css.ScrollView,
        css[direction],
        disabled && css.isDisabled,
        css.shadow,
        visibleShadows.length && shadows && css[camelCase(visibleShadows.join("_"))],
        !shadows && css.noShadows,
      )}
      style={style}
      onScroll={calculateShadows}
      ref={elementRef}
    >
      {children}
    </div>
  );
}
