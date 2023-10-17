export function waitForQuerySelectorAll(doc: any, q: string, timeout: number) {
  if (!timeout) {
    timeout = 1;
  }

  return new Promise(function (resolve) {
    setTimeout(function () {
      return resolve(doc.querySelectorAll(q));
    }, timeout);
  });
}

export function dispatchCancelable(el: HTMLElement, event_name: string) {
  return el.dispatchEvent(new Event(event_name, { bubbles: true, cancelable: true }));
}

export function reactStyleFill(elem: HTMLInputElement, value: string): Promise<string> {
  return new Promise(function (resolve, reject) {
    if (elem === undefined) {
      return reject("no matching element");
    }

    if (dispatchCancelable(elem, "focus") === false) {
      return reject("focus canceled");
    }

    elem.value = value;

    if (dispatchCancelable(elem, "input") === false) {
      return reject("input canceled");
    }

    if (dispatchCancelable(elem, "change") === false) {
      return reject("change canceled");
    }

    return resolve(value);
  });
}
