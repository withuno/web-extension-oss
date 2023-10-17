import { createFramerTransition } from "./create-framer-transition";

const slideTransition = createFramerTransition<{
  x?: number;
  y?: number;
  direction?: -1 | 0 | 1;
  scale?: number;
}>()
  .withVariants({
    enter: ({ x = 0, y = 0, direction = 0, scale = 1 }) => ({
      x: direction > 0 ? x : -x,
      y: direction > 0 ? y : -y,
      scale,
      opacity: direction === 0 ? 1 : 0,
    }),

    exit: ({ x = 0, y = 0, direction = 0, scale = 1 }) => ({
      x: direction < 0 ? x : -x,
      y: direction < 0 ? y : -y,
      scale,
      opacity: direction === 0 ? 1 : 0,
    }),

    visible: {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
    },
  })
  .withReducedMotion({
    enter: ({ direction = 0 }) => ({
      x: 0,
      y: 0,
      scale: 1,
      opacity: direction === 0 ? 1 : 0,
    }),
    exit: ({ direction = 0 }) => ({
      x: 0,
      y: 0,
      scale: 1,
      opacity: direction === 0 ? 1 : 0,
    }),
  });

export function useSlide() {
  return slideTransition.use({
    initial: "enter",
    animate: "visible",
    exit: "exit",
  });
}
