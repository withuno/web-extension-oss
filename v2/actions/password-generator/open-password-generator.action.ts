import { Path } from "@/v2/ui/paths";
import { isMatch } from "@/v2/ui/router";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { CreateLayer } from "../layers/create-layer.action";
import { FocusLayer } from "../layers/focus-layer.action";
import { ViewPasswordGeneratorHint } from "../product-hints/password-generator-hint.action";

export const OpenPasswordGenerator = UnoOrchestrator.registerAction({
  id: "open-password-generator",
  zone: Zone.Content,
  async execute(input?: { passwordInputSelector?: string; confirmPasswordInputSelector?: string }): Promise<void> {
    const { orchestrator, store } = this.context;
    const state = await store.getState();

    if (state.aiAssist.status === "running") {
      return;
    }

    const layersForThisTab = [...(state.layers[orchestrator.runtimeInfo?.tabID] || [])];
    const duplicatePasswordGeneratorLayer = layersForThisTab?.find((layer) => {
      const currentLocation = layer.history.entries[layer.history.index];
      return isMatch(currentLocation, Path.PasswordGenerator);
    });

    if (duplicatePasswordGeneratorLayer) {
      return orchestrator.useAction(FocusLayer)({
        id: duplicatePasswordGeneratorLayer.id,
      });
    }
    // @start V1_COMPAT
    const { setSuggestStrongPwOpen, getSuggestStrongPwOpen, getKeepSuggestStrongPWClosed } = await import(
      "@/v1/content/content_script"
    );
    if (getKeepSuggestStrongPWClosed() === true || getSuggestStrongPwOpen() === true) {
      return;
    }
    setSuggestStrongPwOpen(true);
    // @end V1_COMPAT

    const passwordGeneratorLayer = await orchestrator.useAction(CreateLayer)({
      path: Path.PasswordGenerator,
      searchParams: {
        passwordInput: input?.passwordInputSelector,
        confirmPasswordInput: input?.confirmPasswordInputSelector,
      },
    });

    await orchestrator.useAction(ViewPasswordGeneratorHint)(passwordGeneratorLayer);
  },
});
