import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

import { messageToJSON } from "./uno_types";

export function rootDomainMatch(host1: string, host2: string): boolean {
  if (host1 === host2) return true;

  const rootRE = /^(?:.+\.)*([^..]+)\.([^..]+)$/;

  const root1 = host1.match(rootRE);
  if (root1 === null) return false;
  if (root1.length != 3) return false;

  const root2 = host2.match(rootRE);
  if (root2 === null) return false;
  if (root2.length != 3) return false;

  if (root1[1] == root2[1] && root1[2] == root2[2]) return true;

  return false;
}

export function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf("safari") != -1) {
    if (ua.indexOf("chrome") > -1) {
      // Chrome
      return false;
    }
    // Safari
    return true;
  }
  return false;
}

export function createAnalyticsEvent(eventType: LegacyAnalyticsEvent) {
  chrome.runtime.sendMessage(
    messageToJSON({
      kind: "CREATE_ANALYTICS_EVENT",
      eventType,
    }),
    function () {},
  );
}
