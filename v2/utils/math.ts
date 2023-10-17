/**
 * @returns a random int between `min` and `max`.
 */
export function randomInt(min = 0, max = Infinity) {
  const minNormalized = Math.ceil(min);
  const maxNormalized = Math.floor(max);
  return Math.floor(
    // `max` is exclusive; `min` is inclusive
    Math.random() * (maxNormalized - minNormalized) + minNormalized,
  );
}

/**
 * Clamps a number `num` between minimum `min` and maximum `max`.
 */
export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}
