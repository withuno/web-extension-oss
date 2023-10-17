import { Path } from "@/v2/ui/paths";
import { isMatch } from "@/v2/ui/router";

import { MagicLoginAnalytics } from "./magic-login.analytics";
import { Zone, UnoOrchestrator } from "../../orchestrator";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { CreateLayer } from "../layers/create-layer.action";
import { ViewMagicLoginHint } from "../product-hints/magic-login-hint.action";
import { GetExtensionContext } from "../v1-compat/get-extension-context.action";
import { SetExtensionContext } from "../v1-compat/set-extension-context.action";
import { GetSiteItems } from "../vault/get-site-items.action";

export const OpenMagicLoginMenu = UnoOrchestrator.registerAction({
  id: "magic-login/open-menu",
  zone: Zone.Content,
  concurrency: "magic-login-menu",
  async execute(input: {
    v1Compat: {
      ssoButtonPresent: boolean;
    };
  }): Promise<void> {
    const { orchestrator, store } = this.context;
    const extensionContext = await orchestrator.useAction(GetExtensionContext)();

    const siteItems = (await orchestrator.useAction(GetSiteItems)(window.location.toString())).items;

    const { noOtherModalsShowing: noOtherV1ModalsShowing, getKeepMagicLoginClosed } = await import(
      "@/v1/content/content_script"
    );

    const existingMagicLoginMenu = (await store.getState()).layers[orchestrator.runtimeInfo?.tabID]?.find((layer) => {
      const currentLocation = layer.history.entries[layer.history.index];
      return isMatch(currentLocation, Path.MagicLoginMenu);
    });

    if (
      !existingMagicLoginMenu &&
      noOtherV1ModalsShowing() &&
      siteItems.length &&
      !extensionContext.magicLoginShowing &&
      !getKeepMagicLoginClosed()
    ) {
      await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.MagicLoginDisplayed());

      extensionContext.magicLoginShowing = true;
      await orchestrator.useAction(SetExtensionContext)({
        extensionContext,
      });

      const layer = await orchestrator.useAction(CreateLayer)({
        path: Path.MagicLoginMenu,
        searchParams: {
          ssoButtonPresent: input.v1Compat.ssoButtonPresent,
        },
      });

      await orchestrator.useAction(ViewMagicLoginHint)(layer);
    }
  },
});
