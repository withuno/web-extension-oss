import { AnalyticsBrowser, Plugin, Context } from "@segment/analytics-next";

export const segment = AnalyticsBrowser.load({
  writeKey: process.env.SEGMENT_API_KEY,
});

const BuildEnrichment: Plugin = {
  name: "Build Enrichment",
  version: "1",
  type: "enrichment",

  isLoaded: () => true,
  load: () => Promise.resolve(),

  page: enrichWithBuildContext,
  alias: enrichWithBuildContext,
  track: enrichWithBuildContext,
  identify: enrichWithBuildContext,
  group: enrichWithBuildContext,
};

function enrichWithBuildContext(ctx: Context): Context {
  const { event } = ctx;
  event.context = event.context || {};
  const buildContext = {
    name: "browser-extension",
    version: chrome.runtime.getManifest().version,
  };
  event.context = { ...event.context, build: buildContext };
  ctx.event = event;

  return ctx;
}

(async () => {
  try {
    // For some reason we have to remove page enrichment for our plugin to work
    // we don't need it anyway since everything goes through the background
    // script...
    await segment.deregister("Page Enrichment");
    await segment.register(BuildEnrichment);
  } catch {
    // Errors here are Segement's issue; nothing we can do about it anyways...
  }
})();
