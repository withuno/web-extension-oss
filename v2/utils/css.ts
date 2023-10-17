import { ensureArray } from "./arrays";

export interface GenerateCssSelectorOptions {
  idAttr?: string | string[];
}

/**
 * Generates a unique CSS selector for the provided `element`.
 */
export function generateCssSelector(element: Element, options?: GenerateCssSelectorOptions): string;
export function generateCssSelector(element?: Element | null, options?: GenerateCssSelectorOptions): string | undefined;
export function generateCssSelector(
  element?: Element | null,
  options?: GenerateCssSelectorOptions,
): string | undefined {
  if (!element) {
    return;
  }

  const idAttrs = ensureArray(options?.idAttr);
  const path = [];
  let parent: ParentNode | null;

  while ((parent = element.parentNode)) {
    const tag = element.tagName.toLowerCase();
    let siblings: HTMLCollection;

    let id = element.id ? `#${element.id}` : null;
    if (id == null) {
      for (const idAttr of idAttrs) {
        if (element?.hasAttribute(idAttr)) {
          const idAttrValue = element.getAttribute(idAttr);
          id = idAttrValue ? `[${idAttr}="${idAttrValue}"]` : null;
        }
      }
    }

    path.unshift(
      id ??
        ((siblings = parent.children),
        Array.from(siblings).filter((sibling) => sibling.tagName === tag).length === 1
          ? tag
          : `${tag}:nth-child(${1 + Array.from(siblings).indexOf(element)})`),
    );

    element = parent as Element;
  }

  return `${path.join(" > ")}`;
}
