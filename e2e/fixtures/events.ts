import type { Page } from "@playwright/test";
import { v4 as uuid } from "uuid";

import type { BaseFixture } from "./base";
import type { ExtractTestEvent, ExtractTestEventData, TestEvent, TestFixtureExtension } from "../types";

export interface EventsFixture {
  /**
   * Dispatches the given `event` type to the foreground page.
   */
  dispatchTestEvent<Ev extends TestEvent.Type>(
    options: ExtractTestEvent<Ev> extends CustomEvent<infer R>
      ? { event: Ev; detail: R; target?: Page }
      : { event: Ev; target?: Page },
  ): Promise<string>;

  /**
   * Waits for the given `event` type to have been dispatched from the test
   * page.
   */
  waitForTestEvent<Ev extends TestEvent.Type>(
    event: Ev,
    options?: { requestID?: string; target?: Page },
  ): Promise<ExtractTestEventData<Ev>>;

  /**
   * Injects a script into the foreground page, then returns a handler that
   * dispatches the given `dispatchEvent` and resolves once the given
   * `successEvent` or `errorEvent` is received by the test runtime.
   */
  createTestEventAPI<
    DispatchEv extends TestEvent.Type,
    SuccessEv extends TestEvent.Type,
    ErrorEv extends TestEvent.Type,
  >(options: {
    dispatchEvent: DispatchEv;
    successEvent: SuccessEv;
    errorEvent: ErrorEv;
    target?: Page;
  }): Promise<
    (
      ...args: ExtractTestEvent<DispatchEv> extends CustomEvent<infer R> ? (R extends void ? [] : [detail: R]) : []
    ) => Promise<ExtractTestEventData<SuccessEv>>
  >;
}

export const EventsFixture: TestFixtureExtension<EventsFixture, BaseFixture> = {
  async dispatchTestEvent({ page }, use) {
    await use(async (options) => {
      const _requestID = uuid();
      const { event, detail, target } = options as any;
      await (target || page).evaluate(
        ({ event, detail, _requestID }: any) => {
          const detailWithRequestID = detail ? { ...detail, _requestID } : { _requestID };
          window.dispatchEvent(new CustomEvent(event, { detail: detailWithRequestID }));
        },
        { event, detail, _requestID },
      );
      return _requestID;
    });
  },

  async waitForTestEvent({ page }, use) {
    await use(async (eventName, options) => {
      const locator = (options?.target || page).locator(
        options?.requestID
          ? `meta.__uno_e2e_event_buffer__[name="${eventName}"][request-id="${options.requestID}"]`
          : `meta.__uno_e2e_event_buffer__[name="${eventName}"]`,
      );
      await locator.waitFor({ state: "attached" });
      return locator.evaluateAll((nodes) => {
        const lastNode = nodes.pop();
        const contentAttr = lastNode?.getAttribute("content");
        return contentAttr ? JSON.parse(contentAttr) : {};
      });
    });
  },

  async createTestEventAPI({ dispatchTestEvent, waitForTestEvent }, use) {
    await use(async ({ dispatchEvent, successEvent, errorEvent, target }) => {
      return async (...args) => {
        const [detail] = args;

        const requestID = await (dispatchTestEvent as any)({
          event: dispatchEvent,
          detail,
          target,
        });

        return new Promise((resolve, reject) => {
          // Wait for success event...
          waitForTestEvent(successEvent, { target, requestID })
            .then((result) => {
              resolve(result);
            })
            .catch(() => {});

          // Wait for error event...
          waitForTestEvent(errorEvent, { target, requestID })
            .then((err) => {
              reject(err);
            })
            .catch(() => {});
        });
      };
    });
  },
};
