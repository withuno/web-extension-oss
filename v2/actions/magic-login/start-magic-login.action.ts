import { SSODetails } from "@/v1/uno_types";

import { MagicLoginAnalytics } from "./magic-login.analytics";
import { Zone, UnoOrchestrator } from "../../orchestrator";
import { AiAssistStartAutomation } from "../ai-assist/automation/start-automation.action";
import { createLoginObjective } from "../ai-assist/objectives/login.objective";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { GetExtensionContext } from "../v1-compat/get-extension-context.action";
import { SetExtensionContext } from "../v1-compat/set-extension-context.action";
import { GetSiteItems } from "../vault/get-site-items.action";

export const StartMagicLogin = UnoOrchestrator.registerAction({
  id: "magic-login/start",
  zone: Zone.Content,
  async execute(input: {
    vaultItemID: string;
    ssoDetails?: SSODetails;
    provenance: "context-aware-modal" | "command-menu";
    v1Compat: {
      ssoButtonPresent: boolean;
    };
  }) {
    const { orchestrator, isDemoHost } = this.context;
    const extensionContext = await orchestrator.useAction(GetExtensionContext)();

    const siteItems = (await orchestrator.useAction(GetSiteItems)(window.location.toString())).items;
    const vaultItem = siteItems.find((v) => v.id === input.vaultItemID);
    const hasSSO = vaultItem?.ssoProvider.length;

    const { findElements, hideDemoSpotlight, resetMagicLoginState, setKeepMagicLoginClosed } = await import(
      "@/v1/content/content_script"
    );

    if (vaultItem && hasSSO && input.ssoDetails && input.v1Compat.ssoButtonPresent) {
      await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.MagicLoginUsedSSO());
      extensionContext.magicLoginAccountSelected = vaultItem;
      extensionContext.magicLoginInitiated = true;
      extensionContext.magicLoginSSOChoice = input.ssoDetails.provider;
      await orchestrator.useAction(SetExtensionContext)({
        extensionContext,
      });
      findElements();
      return;
    }

    if (vaultItem) {
      if (isDemoHost) {
        await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.DemoMagicLoginUsed());
      } else {
        await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.MagicLoginUsed());
      }

      switch (input.provenance) {
        case "context-aware-modal": {
          await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.StartFromContextAwareModal());
          break;
        }

        case "command-menu": {
          await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.StartFromCommandMenu());
          break;
        }
      }

      await orchestrator.useAction(AiAssistStartAutomation)(createLoginObjective({ vaultItemId: vaultItem.id }));

      setKeepMagicLoginClosed(true);
      resetMagicLoginState(extensionContext);
      hideDemoSpotlight();
    }
  },
});
