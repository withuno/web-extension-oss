import { useCallback, useMemo } from "react";

import { AnimationProps, TargetAndTransition, MotionAdvancedProps } from "framer-motion";

import { useReducedMotion } from "../use-reduced-motion";

type FramerVariants<Custom = void, VariantKeys extends string = string> = {
  [P in VariantKeys]: TargetAndTransition | ((custom: Custom) => TargetAndTransition);
};

type OptionalFramerVariants<Custom = void, VariantKeys extends string = string> = {
  [P in VariantKeys]?: TargetAndTransition | ((custom: Custom) => TargetAndTransition);
};

export interface TransitionProps extends AnimationProps, MotionAdvancedProps {}

export interface TransitionHook<TCustom = void> {
  getProps: (custom?: TCustom) => AnimationProps & MotionAdvancedProps;
}

export type TransitionHookData<T extends TransitionHook<any>> = T extends TransitionHook<infer R> ? R : never;

/**
 * Creates a custom animation hook using `framer-motion`.
 */
export function createFramerTransition<TCustom = void>() {
  const createHook =
    <VariantKeys extends string = string>(
      variants: FramerVariants<TCustom, VariantKeys>,
      reducedMotionVariants?: OptionalFramerVariants<TCustom, VariantKeys>,
    ) =>
    (targets: { initial?: VariantKeys; animate?: VariantKeys; exit?: VariantKeys }): TransitionHook<TCustom> => {
      const { initial, animate, exit } = targets;

      const prefersReducedMotion = useReducedMotion();
      const variantsResolved = useMemo(
        () => (prefersReducedMotion ? { ...variants, ...reducedMotionVariants } : { ...variants }),
        [prefersReducedMotion],
      );
      const getProps = useCallback(
        (custom = {} as any) => ({
          custom,
          variants: variantsResolved,
          initial,
          animate,
          exit,
        }),
        [initial, animate, exit, variantsResolved],
      );

      return { getProps };
    };

  const withVariants = <VariantKeys extends string = string>(variants: FramerVariants<TCustom, VariantKeys>) => {
    const withReducedMotion = (reducedMotionVariants: OptionalFramerVariants<TCustom, VariantKeys>) => {
      return { use: createHook(variants, reducedMotionVariants) };
    };
    return { withReducedMotion, use: createHook(variants) };
  };

  return { withVariants };
}
