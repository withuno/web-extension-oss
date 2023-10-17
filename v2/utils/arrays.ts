/**
 * Cast `value` to array. Returns the original value if it's already an array.
 */
export function ensureArray<T>(value: T | T[] = []) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Removes `false`, `null`, and `undefined` values from the given array.
 */
export function cleanArray<T>(value: T[] = []): Exclude<T, false | null | undefined>[] {
  return value.filter((item: any) => {
    if (item === false || item == null) return false;
    return true;
  }) as Exclude<T, false | null | undefined>[];
}
