import { UnoOrchestrator } from "@/v2/orchestrator";

import { GetRawVault } from "./get-raw-vault.action";
import { CacheBustContentScriptSiteItems } from "./populate-site-items.action";

/**
 * Every 5 minutes: cache-bust the vault.
 */
UnoOrchestrator.registerAlarm({
  name: "vault/cache-bust-vault-service",
  periodInMinutes: 5,
  when: Date.now(),
  async onActivate(orchestrator) {
    console.debug("Cache-busting VaultService data...");
    await orchestrator.useAction(GetRawVault)(true);
    await orchestrator.useAction(CacheBustContentScriptSiteItems)();
  },
});
