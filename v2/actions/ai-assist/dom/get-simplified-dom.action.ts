import { encode } from "gpt-tokenizer";

import { isDocument, isElement, isHTMLElement, truthyFilter } from "@/v2/types/type-guards";

import { annotateElement, checkAnnotation, getAnnotatedID } from "./annotate-element";
import { templatize } from "./templatize";
import { Zone, UnoOrchestrator } from "../../../orchestrator";

export const GetSimplifiedDOM = UnoOrchestrator.registerAction({
  id: "ai-assist/dom/get-simplified-dom",
  zone: Zone.Content,
  async execute(): Promise<{ html?: string; tokenCount: number }> {
    const html = templatize(ensureElement(simplifyDOM(document.documentElement)))?.trim();
    const tokenCount = html ? encode(html).length : 0;
    return { html, tokenCount };
  },
});

/**
 * A list of DOM attributes to preserve in the simplified output.
 */
const DOM_ATTRIBUTES_ALLOWLIST = ["for", "aria-label", "data-name", "name", "type", "placeholder", "role", "title"];

function simplifyDOM(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
    return document.createTextNode(`${node.textContent} `);
  }

  if (!isHTMLElement(node)) {
    return null;
  }

  annotateElement(node);

  const visible = checkAnnotation(node, "visible");
  if (!visible) {
    return null;
  }

  let children = Array.from(node.childNodes)
    .map((c) => simplifyDOM(c))
    .filter(truthyFilter);

  // Don't bother with text that is the direct child of the body...
  if (node.tagName === "BODY") {
    children = children.filter((c) => {
      return c.nodeType !== Node.TEXT_NODE;
    });
  }

  const interactive = checkAnnotation(node, "interactive");
  const hasLabel = node.hasAttribute("aria-label") || node.hasAttribute("name");
  const includeNode = interactive || hasLabel;

  // Omit the current DOM node if:
  //   - It provides no interactivity.
  //   - It does not function as a label.
  //   - It contains no additional child nodes.
  if (!includeNode && children.length === 0) {
    return null;
  }

  // If the current DOM node contains a single child, return it directly
  // instead, reducing the overall depth of the markup.
  if (!includeNode && children.length === 1) {
    return children[0];
  }

  // Now that we've reached this code path, the current DOM node meets at least
  // one of the following conditions:
  //   - It provides end-user interactivity.
  //   - It functions as a label [has the "aria-label" or "name" attribute(s)].
  //   - It contains more than one child node.

  // Create a reduced copy of the underlying DOM node,
  // to be appended to the end-result.
  const container = document.createElement(node.tagName);

  // Copy allowed attributes from the underlying DOM node.
  for (const attr of DOM_ATTRIBUTES_ALLOWLIST) {
    if (node.hasAttribute(attr)) {
      container.setAttribute(attr, node.getAttribute(attr) as string);
    }
  }

  if (interactive) {
    // Copy the annotated ID from the underlying DOM node.
    container.setAttribute("id", String(getAnnotatedID(node)));

    if (checkAnnotation(node, "link")) {
      // Replace the text content of the container DOM node with the inner
      // text of the visited element.
      container.textContent = node.innerText;
      return container;
    }
  }

  children.forEach((c) => container.appendChild(c));

  return container;
}

/**
 * @returns an `Element` in place of the given `Node` input. If input is
 * provided as an `Element` already, it's returned as-is. In all other cases,
 * the result is wrapped in a `<div>`.
 */
function ensureElement(node?: Node | null): Element | null {
  // Nodes that are `undefined` or `null` becomes just `null`...
  if (node == null) {
    return null;
  }

  // If we're dealing with a `Document`, return its root `Element` type.
  if (isDocument(node)) {
    return document.documentElement;
  }

  // If we're already dealing with an `Element`-derived Node, return as-is.
  if (isElement(node)) {
    return node;
  }

  // If the Node is not an element type, wrap it with a `<div>`.
  const wrapper = document.createElement("div");
  wrapper.appendChild(node);
  return wrapper;
}
