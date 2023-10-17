import { totp, totpRolloverEdge } from "@/v2/crypto/totp";
import { UnoError } from "@/v2/orchestrator/errors";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const GenerateOneTimeCodeFromLoginItem = UnoOrchestrator.registerAction({
  id: "generate-one-time-code-from-login-item",
  zone: Zone.Background,
  async execute(input: { id: string }): Promise<string> {
    const { vaultService } = this.context;
    const item = await vaultService.getVaultItem(input.id);

    if (item.schema_type !== "login" || item.otpSeed === undefined) {
      throw new UnoError(UnoError.Code.MissingTOTP);
    }

    await totpRolloverEdge();
    return generateTOTP(item.otpSeed);
  },
});

export const GenerateOneTimeCodeFromSeed = UnoOrchestrator.registerAction({
  id: "generate-one-time-code-from-seed",
  zone: Zone.Background,
  async execute(input: { seed: string }): Promise<string> {
    await totpRolloverEdge();
    return generateTOTP(input.seed);
  },
});

function generateTOTP(seed: string) {
  const bytes = atob(seed);
  const buf = new ArrayBuffer(bytes.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) {
    bufView[i] = bytes.charCodeAt(i);
  }
  return totp(buf, Math.floor(Date.now() / 1000));
}
