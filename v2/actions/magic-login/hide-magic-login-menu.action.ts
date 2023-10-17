import { Path } from "@/v2/ui/paths";
import { isMatch } from "@/v2/ui/router";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { RemoveLayer } from "../layers/remove-layer.action";
import { GetExtensionContext } from "../v1-compat/get-extension-context.action";

export const HideMagicLoginMenu = UnoOrchestrator.registerAction({
  id: "magic-login/hide-menu",
  zone: Zone.Content,
  concurrency: "magic-login-menu",
  async execute() {
    const { orchestrator, store } = this.context;

    // @start V1_COMPAT
    const { hideMagicLoginModal, setKeepMagicLoginClosed } = await import("@/v1/content/content_script");
    const extensionContext = await orchestrator.useAction(GetExtensionContext)();
    setKeepMagicLoginClosed(true);
    hideMagicLoginModal(extensionContext);
    // @end V1_COMPAT

    const existingMagicLoginMenu = (await store.getState()).layers[orchestrator.runtimeInfo?.tabID]?.find((layer) => {
      const currentLocation = layer.history.entries[layer.history.index];
      return isMatch(currentLocation, Path.MagicLoginMenu);
    });

    if (existingMagicLoginMenu) {
      await orchestrator.useAction(RemoveLayer)({ id: existingMagicLoginMenu.id });
    }
  },
});
