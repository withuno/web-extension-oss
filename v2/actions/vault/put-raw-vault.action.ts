import type { VaultServiceError } from "@/v1/service/vault_service/service";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const PutRawVault = UnoOrchestrator.registerAction({
  id: "put-raw-vault",
  zone: Zone.Background,
  concurrency: 1,
  async execute(input: { vault: any }): Promise<void> {
    const { vaultService } = this.context;

    // TODO: port individual background helper functions...
    // @start V1_COMPAT
    const { handle_vault_service_error } = await import("@/v1/background");
    // @end V1_COMPAT

    try {
      await vaultService.putRawVault(input.vault);
    } catch (e) {
      throw new Error(String(handle_vault_service_error(e as VaultServiceError)));
    }
  },
});
