import { FloatingArrow } from "@floating-ui/react";
import { clsx } from "clsx";
import { useIsPresent } from "framer-motion";

import { Base } from "./base";
import { transitions } from "../../hooks/transitions";
import { Styleable, WithChildren } from "../../prop.types";
import { useRouterState } from "../../router";
import { useCloseLayer, useFloatingLayerArrow, useLayerFocus } from "../layer-context";

export namespace Tooltip {
  export function Layout(props: WithChildren) {
    const layerFocus = useLayerFocus();
    const arrow = useFloatingLayerArrow();
    const { direction } = useRouterState();

    const isPresent = useIsPresent();

    const containerAnimation = transitions.useScale().getProps(0.97);
    const viewAnimation = transitions.useSlide().getProps({ x: isPresent && direction ? 50 : 0, direction });

    return (
      <Base.Layout
        id="tooltip"
        className={clsx(
          "pointer-events-auto flex flex-col overflow-hidden bg-[#FFD729] p-4 text-left text-xs font-semibold",
          !layerFocus.isFocused && !layerFocus.childIsFocused && !layerFocus.parentIsFocused && "brightness-90",
        )}
        style={{ borderRadius: 12 }}
        transition={{
          duration: 0.15,
          layout: { duration: 0.1, ease: "easeInOut" },
        }}
        {...containerAnimation}
      >
        <Base.View transition={{ duration: 0.15 }} {...viewAnimation}>
          {!!arrow && <FloatingArrow className="fill-[#FFD729]" {...arrow} />}
          {props.children}
        </Base.View>
      </Base.Layout>
    );
  }

  export function CloseButton(props: Styleable) {
    const { className, style } = props;
    const close = useCloseLayer();
    return (
      <button className={className} style={style} onClick={close} aria-label="Close">
        <svg width="17" height="17" viewBox="0 0 17 17" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.36719 16.8281C12.7266 16.8281 16.3359 13.2109 16.3359 8.85938C16.3359 4.5 12.7188 0.890625 8.35938 0.890625C4.00781 0.890625 0.398438 4.5 0.398438 8.85938C0.398438 13.2109 4.01562 16.8281 8.36719 16.8281ZM5.74219 12.1406C5.38281 12.1406 5.10156 11.8516 5.10156 11.4922C5.10156 11.3203 5.16406 11.1562 5.28906 11.0391L7.45312 8.86719L5.28906 6.70312C5.16406 6.57812 5.10156 6.42188 5.10156 6.25C5.10156 5.88281 5.38281 5.60938 5.74219 5.60938C5.92188 5.60938 6.0625 5.67188 6.1875 5.78906L8.36719 7.96094L10.5625 5.78125C10.6953 5.64844 10.8359 5.59375 11.0078 5.59375C11.3672 5.59375 11.6562 5.875 11.6562 6.23438C11.6562 6.41406 11.6016 6.55469 11.4609 6.69531L9.28906 8.86719L11.4531 11.0312C11.5859 11.1484 11.6484 11.3125 11.6484 11.4922C11.6484 11.8516 11.3594 12.1406 10.9922 12.1406C10.8125 12.1406 10.6484 12.0781 10.5312 11.9531L8.36719 9.78125L6.21094 11.9531C6.08594 12.0781 5.92188 12.1406 5.74219 12.1406Z" />
        </svg>
      </button>
    );
  }
}
