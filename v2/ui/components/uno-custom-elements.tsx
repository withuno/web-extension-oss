import React, { forwardRef } from "react";

import type { WithChildren } from "../prop.types";

export type UnoCustomElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

export const UnoContainer = forwardRef<HTMLElement, WithChildren>((props, ref) => {
  return <UnoCustomElementBase slot="uno-container" {...props} ref={ref} />;
});

export const UnoContentScripts = forwardRef<HTMLElement, UnoCustomElementProps>((props, ref) => {
  return <UnoCustomElementBase slot="uno-content-scripts" {...props} ref={ref} />;
});

export const UnoLightbox = forwardRef<HTMLElement, UnoCustomElementProps>((props, ref) => {
  return <UnoCustomElementBase slot="uno-lightbox" {...props} ref={ref} />;
});

export const UnoLayer = forwardRef<HTMLElement, UnoCustomElementProps>((props, ref) => {
  return <UnoCustomElementBase slot="uno-layer" {...props} ref={ref} />;
});

export const UnoLayerBody = forwardRef<HTMLElement, UnoCustomElementProps>((props, ref) => {
  return <UnoCustomElementBase slot="uno-layer-body" {...props} ref={ref} />;
});

// -------------------------------------------------------------------------- //

namespace UnoCustomElementBase {
  export interface Props extends UnoCustomElementProps {
    slot: string;
  }
}

const UnoCustomElementBase = forwardRef<HTMLElement, UnoCustomElementBase.Props>((props, ref) => {
  const { slot, className, style, children, ...otherProps } = props;
  return React.createElement(
    slot,
    {
      class: className,
      style,
      ...otherProps,
      ref,
    },
    children,
  );
});
