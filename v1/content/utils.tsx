import React, { useState, useEffect } from "react";

export function textFill(el: HTMLInputElement, v: string) {
  if (el === null) return;

  el.value = v;

  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true }));

  el.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, cancelable: true }));

  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }));

  el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));

  el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
}

export function pressEnter(el: HTMLInputElement) {
  if (el === null) return;

  el.focus();
  el.dispatchEvent(
    new KeyboardEvent("keypress", {
      key: "Enter",
      bubbles: true,
      keyCode: 13,
      charCode: 13,
    }),
  );
  el.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      keyCode: 13,
      charCode: 13,
    }),
  );
  el.dispatchEvent(
    new KeyboardEvent("keyup", {
      key: "Enter",
      bubbles: true,
      keyCode: 13,
      charCode: 13,
    }),
  );
}

export function debounce<Params extends any[]>(func: (...args: Params) => any, timeout: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Params) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
    }, timeout);
  };
}

export const DEFAULT_OPTIONS = {
  config: {
    attributes: true,
    childList: true,
    subtree: true,
  },
  debounceTime: 0,
};

export function useMutationObservable(targetEl: HTMLElement, cb: any, options = DEFAULT_OPTIONS) {
  const [observer, setObserver] = useState<MutationObserver | null>(null);

  useEffect(() => {
    const { debounceTime } = options;
    const obs = new MutationObserver(debounceTime > 0 ? debounce(cb, debounceTime) : cb);
    setObserver(obs);
  }, [cb, setObserver]);

  useEffect(() => {
    if (!observer) return;
    const { config } = options;
    observer.observe(targetEl, config || DEFAULT_OPTIONS.config);
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [observer, targetEl]);
}

export function Expire(props: { delay: number; onExpire: any; children: any }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setVisible(false);
      props.onExpire && props.onExpire();
    }, props.delay);
  }, [props.delay]);

  return visible ? <>{props.children}</> : <></>;
}
