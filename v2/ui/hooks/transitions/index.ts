import { useFade } from "./use-fade";
import { useScale, useScaleIn, useScaleOut } from "./use-scale";
import { useSlide } from "./use-slide";

export const transitions = {
  useFade,
  useSlide,
  useScale,
  useScaleIn,
  useScaleOut,
};

export * from "./create-framer-transition";
