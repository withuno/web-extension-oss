import { createFramerTransition } from "./create-framer-transition";

const fadeTransition = createFramerTransition().withVariants({
  visible: { opacity: 1, transition: { duration: 0.2 } },
  hidden: { opacity: 0, transition: { duration: 0.2 } },
});

export function useFade() {
  return fadeTransition.use({
    initial: "hidden",
    animate: "visible",
    exit: "hidden",
  });
}
