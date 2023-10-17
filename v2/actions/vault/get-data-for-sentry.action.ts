import { Zone, UnoOrchestrator } from "../../orchestrator";

export const GetDataForSentry = UnoOrchestrator.registerAction({
  id: "get-data-for-sentry",
  zone: Zone.Background,
  async execute(): Promise<{ uuid?: string; email?: string }> {
    const { vaultService, vaultInfo } = this.context;

    if (vaultInfo.needsOnboard) {
      return {};
    }

    const vault = await vaultService.getVault();
    return {
      uuid: vault.uuid,
      email: vault.email,
    };
  },
});
