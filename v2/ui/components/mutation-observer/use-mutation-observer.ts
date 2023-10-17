import { MutableRefObject, useEffect } from "react";

import { useIsMounted } from "usable-react";

import { isHTMLElement, isRefObject } from "@/v2/types/type-guards";

import { MutationObserverOptions, MutationType } from "./mutation-observer.types";

export function useMutationObserver(
  ref: Node | null | undefined | MutableRefObject<Node | null>,
  options: MutationObserverOptions,
) {
  const {
    subtree,
    categories,
    attributeList,
    suppressAttributeOldValue,
    suppressCharacterDataOldValue,
    onMutation,
    onChildAdded,
    onChildRemoved,
    onContentChange,
    onAttributeChange,
  } = options;

  const isMounted = useIsMounted();

  useEffect(() => {
    const el = isRefObject(ref) ? ref.current : ref;

    if (el) {
      const observer = new MutationObserver((mutations) => {
        Array.from(mutations).forEach((data) => {
          if (isMounted()) {
            onMutation?.(data);

            // eslint-disable-next-line default-case
            switch (data.type) {
              case MutationType.Attributes: {
                return onAttributeChange?.({
                  from: data.oldValue,
                  to:
                    data.attributeName && isHTMLElement(data.target)
                      ? data.target.getAttribute(data.attributeName)
                      : null,
                  name: data.attributeName,
                  namespace: data.attributeNamespace,
                  target: data.target,
                });
              }

              case MutationType.CharacterData: {
                return onContentChange?.({
                  from: data.oldValue,
                  to:
                    data.attributeName && isHTMLElement(data.target)
                      ? data.target.getAttribute(data.attributeName)
                      : null,
                  target: data.target,
                });
              }

              case MutationType.ChildList: {
                if (data.addedNodes.length > 0) {
                  Array.from(data.addedNodes).forEach((child) => {
                    onChildAdded?.({
                      child,
                      nextSibling: data.nextSibling,
                      previousSibling: data.previousSibling,
                      target: data.target,
                    });
                  });
                }

                if (data.removedNodes.length > 0) {
                  Array.from(data.removedNodes).forEach((child) => {
                    onChildRemoved?.({
                      child,
                      nextSibling: data.nextSibling,
                      previousSibling: data.previousSibling,
                      target: data.target,
                    });
                  });
                }

                break;
              }
            }
          }
        });
      });

      observer.observe(
        el,
        createMutationObserverInit({
          subtree,
          categories,
          attributeList,
          suppressAttributeOldValue,
          suppressCharacterDataOldValue,
        }),
      );

      return () => {
        observer.disconnect();
      };
    }
  }, [
    isMounted,
    ref,
    subtree,
    JSON.stringify(categories),
    JSON.stringify(attributeList),
    suppressAttributeOldValue,
    suppressCharacterDataOldValue,
    onMutation,
    onChildAdded,
    onChildRemoved,
    onContentChange,
    onAttributeChange,
  ]);
}

function createMutationObserverInit(
  options: Pick<
    MutationObserverOptions,
    "subtree" | "categories" | "attributeList" | "suppressAttributeOldValue" | "suppressCharacterDataOldValue"
  >,
): MutationObserverInit {
  const {
    subtree,
    categories = [MutationType.ChildList, MutationType.Attributes, MutationType.CharacterData],
    attributeList,
    suppressAttributeOldValue,
    suppressCharacterDataOldValue,
  } = options;

  const config: MutationObserverInit = {
    subtree,
    attributeOldValue: !suppressAttributeOldValue && categories.includes(MutationType.Attributes),
    characterDataOldValue: !suppressCharacterDataOldValue && categories.includes(MutationType.CharacterData),
    attributeFilter:
      (attributeList?.length ?? NaN) > 0 && categories.includes(MutationType.Attributes) ? attributeList : undefined,
    childList: categories.length === 0 ? true : undefined,
    ...Object.fromEntries(categories.map((key) => [key, true])),
  };

  return config;
}
