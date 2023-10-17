import { GetSiteItems } from "./get-site-items.action";
import { useSiteItems } from "./use-site-items";
import { Zone, UnoOrchestrator } from "../../orchestrator";

export const PopulateSiteItems = UnoOrchestrator.registerAction({
  id: "vault/populate-site-items",
  zone: Zone.Content,
  async execute(): Promise<void> {
    const { orchestrator } = this.context;

    const siteItems = await orchestrator.useAction(GetSiteItems)(window.location.toString());
    useSiteItems.cache.set(useSiteItems.cacheKey, siteItems);

    orchestrator.events.on("cache-bust-content-script-site-items", async () => {
      const siteItems = await orchestrator.useAction(GetSiteItems)(window.location.toString());
      useSiteItems.cache.set(useSiteItems.cacheKey, siteItems);
    });
  },
});

export const CacheBustContentScriptSiteItems = UnoOrchestrator.registerAction({
  id: "vault/repopulate-site-items",
  zone: Zone.Background,
  async execute(): Promise<void> {
    const { orchestrator } = this.context;
    orchestrator.events.emit("cache-bust-content-script-site-items");
  },
});
