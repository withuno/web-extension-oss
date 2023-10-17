import React from "react";

import { clsx } from "clsx";

import { mergeProps } from "@/v2/utils/react-props";

import css from "./skeleton.module.css";
import { IntrinsicElementProps } from "../../ui.types";
import { EscapeCharacters } from "../text";

export namespace Skeleton {
  export interface Props extends IntrinsicElementProps<"span"> {
    count?: number;
    duration?: number; // milliseconds
    shape?: "rectangle" | "ellipse" | "pill" | "unset";
    width?: React.CSSProperties["width"];
    height?: React.CSSProperties["height"];
    leading?: "inherit" | "unset";
  }
}

/**
 * Renders an animated loading skeleton that automatically adapts to the current
 * font-size and line-height.
 *
 * Based on `react-loading-skeleton`.
 *
 * @see the LICENSE file at the root of this source tree:
 *   https://github.com/dvtng/react-loading-skeleton
 *
 * Modifications from original source:
 *   - Removes usage of `emotion` for CSS.
 *   - Adds `shape` prop to control the general shape of the skeleton.
 *   - Adds `textPreset` prop to control baseline text styles from which to determine the skeleton dimensions.
 *   - Adds default TypeScript support.
 *   - Enable float values for `count` prop (which renders a partial width line)
 */
export function Skeleton(props: Skeleton.Props) {
  const { count = 1, duration = 1500, shape, width = "100%", height, leading = "unset", ...spanProps } = props;

  const skeletons: JSX.Element[] = [];

  for (let i = 0; i < count; i++) {
    skeletons.push(
      <span
        key={i}
        {...mergeProps(
          {
            className: clsx(
              css.Skeleton,

              "inline-block overflow-hidden relative",

              leading === "unset" && "leading-none",

              // Note: by explicitly passing `<Skeleton shape="unset" />`,
              // "border-radius" can then be customized using Tailwind CSS
              // utilities.
              (shape == null || shape === "rectangle") && "rounded-md",
              shape === "ellipse" && "rounded-circle",
              shape === "pill" && "rounded-full",
            ),
            style: {
              width: count - i < 1 ? `calc(100% * ${count - i})` : width,
              height,
              "--uno-Skeleton__duration": `${duration}ms`,
            } as any,
          },
          spanProps,
        )}
      >
        <EscapeCharacters.ZeroWidthNonJoiner />
      </span>,
    );
  }

  return <>{skeletons}</>;
}
