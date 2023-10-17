import { useRef } from "react";

import { MutationObserverOptions } from "./mutation-observer.types";
import { useMutationObserver } from "./use-mutation-observer";
import { Styleable, WithChildren } from "../../prop.types";

export namespace WatchForMutations {
  export interface Prop extends MutationObserverOptions, WithChildren, Styleable {}
}

/**
 * A declarative interface wrapping `MutationObserver` APIs.
 */
export function WatchForMutations(props: WatchForMutations.Prop) {
  const {
    // `MutationObserverOptions`
    subtree = false,
    categories,
    attributeList,
    suppressAttributeOldValue,
    suppressCharacterDataOldValue,
    onMutation,
    onChildAdded,
    onChildRemoved,
    onContentChange,
    onAttributeChange,

    // `<div>` props
    className,
    style,
    children,
  } = props;

  const ref = useRef<HTMLDivElement | null>(null);

  useMutationObserver(ref, {
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
  });

  return (
    <div className={className} style={style} ref={ref}>
      {children}
    </div>
  );
}
