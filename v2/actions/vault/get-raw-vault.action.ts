import type { VaultServiceError } from "@/v1/service/vault_service/service";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const GetRawVault = UnoOrchestrator.registerAction({
  id: "get-raw-vault",
  zone: Zone.Background,
  concurrency: 1,
  async execute(force_sync?: boolean): Promise<any> {
    const { vaultService } = this.context;

    // TODO: port individual background helper functions...
    // @start V1_COMPAT
    const { handle_vault_service_error } = await import("@/v1/background");
    // @end V1_COMPAT

    try {
      return vaultService.getRawVault(force_sync);
    } catch (e) {
      throw new Error(String(handle_vault_service_error(e as VaultServiceError)));
    }
  },
});
