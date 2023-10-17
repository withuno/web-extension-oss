/**
 * @returns `input` with its first character capitalizedl.
 */
export function capitalizeFirstLetter(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}
