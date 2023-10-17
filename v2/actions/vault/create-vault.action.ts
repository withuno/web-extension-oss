import type { VaultServiceError } from "@/v1/service/vault_service/service";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const CreateVault = UnoOrchestrator.registerAction({
  id: "create-vault",
  zone: Zone.Background,
  concurrency: 1,
  async execute(input: { email?: string }): Promise<void> {
    const { vaultService, vaultInfo } = this.context;
    const { needsOnboard, seed, clientID } = vaultInfo;
    if (needsOnboard) {
      // TODO: port individual background helper functions...
      // @start V1_COMPAT
      const { storeRealSeed, storeClientId } = await import("@/v1/state");
      const { handle_vault_service_error, analytics_identify } = await import("@/v1/background");
      // @end V1_COMPAT

      let ok: boolean;
      try {
        ok = await vaultService.createVault(input.email || undefined);
      } catch (e) {
        throw new Error(String(handle_vault_service_error(e as VaultServiceError)));
      }

      if (ok) {
        await storeRealSeed(seed);
        await storeClientId(clientID);
        await analytics_identify(vaultService);
      }
    }
  },
});
