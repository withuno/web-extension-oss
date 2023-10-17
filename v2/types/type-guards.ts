import type { MutableRefObject, RefObject, SyntheticEvent } from "react";

export function isPromise<T>(p: T | Promise<T>): p is Promise<T> {
  return !!p && (typeof p === "object" || typeof p === "function") && typeof (p as any).then === "function";
}

export function isDocument(obj: any): obj is Document {
  return obj instanceof HTMLDocument || obj instanceof Document;
}

export function isWindow(obj: any): obj is Window {
  return obj instanceof Window;
}

export function isRefObject<T>(obj: any): obj is RefObject<T> | MutableRefObject<T> {
  // eslint-disable-next-line no-prototype-builtins
  return obj?.hasOwnProperty("current");
}

export function isElement<T extends Element>(obj: any): obj is T {
  return obj instanceof Element;
}

export function isHTMLElement<T extends HTMLElement>(obj: any): obj is T {
  return obj instanceof HTMLElement;
}

export function isSVGElement<T extends SVGElement>(obj: any): obj is T {
  return obj instanceof SVGElement;
}

export function isSyntheticEvent<T extends SyntheticEvent>(obj: any): obj is T;
export function isSyntheticEvent<T = Element, E = Event>(obj: any): obj is SyntheticEvent<T, E>;
export function isSyntheticEvent(obj: any): obj is SyntheticEvent {
  return (obj as SyntheticEvent)?.nativeEvent instanceof Event;
}

export function truthyFilter<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}
