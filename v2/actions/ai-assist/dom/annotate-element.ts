import { ensureArray } from "@/v2/utils/arrays";

const ANNOTATED_ID_ATTRIBUTE = "data-uno-annotated-id";
const ANNOTATED_MODIFIER_ATTRIBUTE = "data-uno-annotated-modifiers";

/**
 * An enumeration of annotation types that are applied
 * conditionally via `annotateElement`.
 */
export type Annotation = "interactive" | "visible" | "link";

/**
 * Annotates `element` with the following:
 *   - A generated ID, if one is not currently set on the element.
 *   - A list of `Annotations`, applied to a "data-*" attribute. These can be
 *     checked with the `checkAnnotation` function.
 */
export function annotateElement(element: Element) {
  // Annotate with an ID, if none is set.
  if (!element.hasAttribute(ANNOTATED_ID_ATTRIBUTE)) {
    element.setAttribute(ANNOTATED_ID_ATTRIBUTE, String(incrementer.next().value));
  }

  // Annotate with modifiers:
  const style = window.getComputedStyle(element);
  if (isInteractive(element, style)) {
    appendAnnotation(element, "interactive");
  }
  if (isVisible(element, style)) {
    appendAnnotation(element, "visible");
  }
  if (isLink(element)) {
    appendAnnotation(element, "link");
  }
}

/**
 * @returns `true` if the given `element` has ANY of the expected annotation
 * types.
 */
export function checkAnnotation(element: Element, annotationType: Annotation | Annotation[]) {
  const modifiers = element.getAttribute(ANNOTATED_MODIFIER_ATTRIBUTE)?.split(/\s+/g);
  return ensureArray(annotationType).some((a) => {
    return modifiers?.includes(a);
  });
}

/**
 * @returns `true` if the given `element` has ALL of the expected annotation
 * types.
 */
export function checkAnnotationStrict(element: Element, annotationType: Annotation | Annotation[]) {
  const modifiers = element.getAttribute(ANNOTATED_MODIFIER_ATTRIBUTE)?.split(/\s+/g);
  return ensureArray(annotationType).every((a) => {
    return modifiers?.includes(a);
  });
}

/**
 * @returns the ID attribute generated/decorated by `annotateElement`.
 */
export function getAnnotatedID(element: Element): number | null {
  const idAttr = element.getAttribute(ANNOTATED_ID_ATTRIBUTE);
  if (idAttr == null) {
    return null;
  }
  return Number(idAttr);
}

/**
 * Queries the root document (or another provided `root`) for elements annotated
 * with the given `id`.
 */
export function getElementByAnnotatedID<El extends Element>(id?: number, root?: Document | ShadowRoot): El | null {
  const selector = generateSelectorForAnnotatedID(id);
  if (!selector) {
    return null;
  }
  return (root || document).querySelector(selector) as El;
}

/**
 * Generates a selector to find an element by it's annotated ID.
 */
export function generateSelectorForAnnotatedID(id?: number) {
  if (!id) {
    return null;
  }
  return `[${ANNOTATED_ID_ATTRIBUTE}="${id}"]`;
}

/**
 * @returns `true` if the `element` is inferred to be interactive; `false`
 * otherwise.
 */
function isInteractive(element: Element, style: CSSStyleDeclaration) {
  return (
    element.tagName === "A" ||
    element.tagName === "INPUT" ||
    element.tagName === "BUTTON" ||
    element.tagName === "SELECT" ||
    element.tagName === "TEXTAREA" ||
    element.hasAttribute("onclick") ||
    element.hasAttribute("onmousedown") ||
    element.hasAttribute("onmouseup") ||
    element.hasAttribute("onkeydown") ||
    element.hasAttribute("onkeyup") ||
    element.hasAttribute("onpointercancel") ||
    element.hasAttribute("onpointerdown") ||
    element.hasAttribute("onpointerenter") ||
    element.hasAttribute("onpointerleave") ||
    element.hasAttribute("onpointermove") ||
    element.hasAttribute("onpointerout") ||
    element.hasAttribute("onpointerover") ||
    element.hasAttribute("onpointerup") ||
    element.hasAttribute("role") ||
    style.cursor === "pointer"
  );
}

/**
 * @returns `true` if the `element` is inferred to be visible; `false`
 * otherwise.
 */
function isVisible(element: Element, style: CSSStyleDeclaration) {
  const rect = element.getBoundingClientRect();
  const xOverlap = Math.max(0, Math.min(rect.x + rect.width, window.innerWidth) - Math.max(rect.x, 0));
  const yOverlap = Math.max(0, Math.min(rect.y + rect.height, window.innerHeight) - Math.max(rect.y, 0));
  const elementArea = rect.width * rect.height;
  const overlapArea = xOverlap * yOverlap;
  const percentInView = overlapArea / elementArea;
  const isInView = percentInView > 0;

  return (
    isInView &&
    style.opacity !== "" &&
    style.opacity !== "0" &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getAttribute("aria-hidden") !== "true"
  );
}

/**
 * @returns `true` if the `element` is inferred to be link-like; `false`
 * otherwise.
 */
function isLink(element: Element) {
  return (
    element.tagName === "A" ||
    element.tagName === "BUTTON" ||
    element.getAttribute("role") === "link" ||
    element.getAttribute("role") === "button"
  );
}

/**
 * Appends the given `annotationType` to `element`.
 */
function appendAnnotation(element: Element, annotationType: Annotation) {
  if (element.hasAttribute(ANNOTATED_MODIFIER_ATTRIBUTE)) {
    const currentModifiers = element.getAttribute(ANNOTATED_MODIFIER_ATTRIBUTE)?.split(/\s+/g);
    if (currentModifiers && !currentModifiers.includes(annotationType)) {
      element.setAttribute(ANNOTATED_MODIFIER_ATTRIBUTE, [...currentModifiers, annotationType].join(" "));
    } else {
      element.setAttribute(ANNOTATED_MODIFIER_ATTRIBUTE, annotationType);
    }
  } else {
    element.setAttribute(ANNOTATED_MODIFIER_ATTRIBUTE, annotationType);
  }
}

/**
 * A generator function that provides an incrementing integer index for
 * generating unique IDs via `annotateElement`.
 */
const incrementer = (function* () {
  let index = 0;
  while (true) {
    yield index++;
  }
})();
