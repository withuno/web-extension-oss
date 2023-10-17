import * as Sentry from "@sentry/browser";

import { type UnoOrchestrator, Zone } from "../index";

/**
 * Initialize Sentry tracing for the specified orchestrator `zone`.
 */
export function initializeSentryClient(zone: Zone) {
  switch (zone) {
    case Zone.Background:
    case Zone.Popup: {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.ENV_NAME,
        release: process.env.EXT_VERSION,
      });
      break;
    }

    case Zone.Content:
    default: {
      const extensionBaseUrl = chrome.runtime.getURL("content.entry.js").replace(/\//g, "\\/");

      // Search for the browser's content script, or search for "://hidden/"
      //
      // The "hidden" url is used for Safari. Safari has a privacy feature to
      // obfuscate extension urls This is a hack to make sure we still capture
      // errors on Safari, and may pick up errors from other installed
      // extensions.
      const contentScriptUrlRegex = new RegExp(`^(${extensionBaseUrl}|.*:\\/\\/hidden\\/)$`, "i");

      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.ENV_NAME,
        release: process.env.EXT_VERSION,
        beforeSend: (event) => {
          // Remove the `url` attribute from the stack trace
          if (event.request && event.request.url) {
            delete event.request.url;
          }
          if (event.request && event.request.headers && event.request.headers.referer) {
            delete event.request.headers.referer;
          }
          return event;
        },
        integrations: [
          new Sentry.Integrations.InboundFilters({
            allowUrls: [contentScriptUrlRegex],
          }),
        ],
      });
    }
  }
}

/**
 * Initialize the current Sentry user for the specified `orchestrator`.
 */
export async function initializeSentryUser(orchestrator: UnoOrchestrator) {
  try {
    const { GetDataForSentry } = await import("@/v2/actions/vault/get-data-for-sentry.action");
    const { uuid, email } = await orchestrator.useAction(GetDataForSentry)();
    Sentry.setUser({
      email,
      id: uuid,
      ip_address: "",
    });
  } catch {
    // swallow error
  }
}
