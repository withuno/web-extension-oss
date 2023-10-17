import type { Vault as VaultServiceVault } from "@/v1/service/vault_service/service";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const GetSiteItems = UnoOrchestrator.registerAction({
  id: "vault/get-site-items",
  zone: Zone.Background,
  async execute(url: string): Promise<VaultServiceVault> {
    const { vaultService } = this.context;
    const { hostname } = new URL(url);

    // @start V1_COMPAT
    const { getSiteItems } = await import("@/v1/background");
    const siteItems = getSiteItems(vaultService, hostname);
    // @end V1_COMPAT

    return siteItems;
  },
});
