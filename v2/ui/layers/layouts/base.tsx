import { HTMLMotionProps, LayoutGroup, motion } from "framer-motion";

import { AnimatePresencePropagated } from "../../components/animate-presence-propagated";
import type { TransitionProps } from "../../hooks/transitions";
import type { Styleable, WithChildren } from "../../prop.types";
import { useRouterState } from "../../router";
import { useLayer, useFloatingLayerIsPositioned } from "../layer-context";

export namespace Base {
  export interface ContainerProps extends Styleable, WithChildren, TransitionProps {
    id: string;
    layout?: HTMLMotionProps<"div">["layout"];
  }

  export function Layout(props: ContainerProps) {
    const layer = useLayer();
    const isPositioned = useFloatingLayerIsPositioned();

    const { id, layout = isPositioned, className, style, children, ...transitionProps } = props;

    const key = `${id}:${layer.id}:${layout}`;

    return (
      <LayoutGroup id={key}>
        <motion.div
          key={key}
          layoutId={layout ? key : undefined}
          className={className}
          style={style}
          {...transitionProps}
        >
          {children}
        </motion.div>
      </LayoutGroup>
    );
  }

  export interface ViewProps extends Styleable, WithChildren, TransitionProps {}

  export function View(props: ViewProps) {
    const { className, style, children, ...transitionProps } = props;
    const { location } = useRouterState();
    const isPositioned = useFloatingLayerIsPositioned();

    return (
      <AnimatePresencePropagated mode="wait" custom={transitionProps.custom} initial={false}>
        <motion.div
          layout={isPositioned ? "position" : undefined}
          key={location.href}
          className={className}
          style={style}
          {...transitionProps}
        >
          {children}
        </motion.div>
      </AnimatePresencePropagated>
    );
  }
}
