import { createFramerTransition } from "./create-framer-transition";

const scaleTransition = createFramerTransition<number | string>()
  .withVariants({
    hiddenWithScale: (scale) => ({ opacity: 0, scale }),
    hiddenWithoutScale: { opacity: 0, scale: 1 },
    visible: { opacity: 1, scale: 1 },
  })
  .withReducedMotion({
    hiddenWithScale: { opacity: 0, scale: 1 },
    hiddenWithoutScale: { opacity: 0, scale: 1 },
  });

export function useScale() {
  return scaleTransition.use({
    initial: "hiddenWithScale",
    animate: "visible",
    exit: "hiddenWithScale",
  });
}

export function useScaleIn() {
  return scaleTransition.use({
    initial: "hiddenWithScale",
    animate: "visible",
    exit: "hiddenWithoutScale",
  });
}

export function useScaleOut() {
  return scaleTransition.use({
    initial: "hiddenWithoutScale",
    animate: "visible",
    exit: "hiddenWithScale",
  });
}
