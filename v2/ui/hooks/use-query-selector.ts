import { useMemo } from "react";

import { useUnoOrchestrator } from "../../orchestrator/react";

/**
 * @returns an element resolved from the given `selector` string. Optionally, a
 * query root can be provided in the form of a `Document`, `ShadowRoot`, or
 * another selector string to resolve an open `ShadowRoot` somewhere in the DOM.
 */
export function useQuerySelector<El extends Element>(
  selector?: string | null,
  shadowRootSelector?: string | null,
): El | null;
export function useQuerySelector<El extends Element>(
  selector?: string | null,
  root?: Document | ShadowRoot | null,
): El | null;
export function useQuerySelector<El extends Element>(
  selector?: string | null,
  rootRef?: string | null | Document | ShadowRoot,
) {
  const { root } = useUnoOrchestrator();

  // Resolve the element using the given `selector` in one of three cases (in order):
  //   1. As an element attached to a shadow root in the parent page.
  //   2. As an element attached to Uno's shadow root (i.e.: another layer).
  //   3. As an element attached to the `Document` of the parent page.
  // If no reference element can be resolved, `null` is returned.
  return useMemo<El | null>(() => {
    if (selector) {
      if (rootRef) {
        // If `rootRef` is provided as a string to query a shadow root somewhere
        // in the document, the result will only be defined if the shadow root
        // is "open".
        // NOTE: this case is typically reserved for V1 compatibilty...
        const externalRoot = typeof rootRef === "string" ? document.querySelector(rootRef)?.shadowRoot : rootRef;
        if (externalRoot) {
          return externalRoot?.querySelector(selector) ?? null;
        }
      }

      if (root === document) {
        return document.querySelector(selector) ?? null;
      }

      return root.querySelector(selector) ?? document.querySelector(selector) ?? null;
    }
    return null;
  }, [selector, rootRef, root]);
}
