import { Zone, UnoOrchestrator } from "../../orchestrator";
import { Path } from "../../ui/paths";
import { isMatch } from "../../ui/router";
import { LegacyAnalyticsEvent } from "../analytics/analytics.types";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { CreateLayer } from "../layers/create-layer.action";
import { RemoveLayer } from "../layers/remove-layer.action";
import { CloseAllOtherV1Modals } from "../v1-compat/close-all-other-v1-modals.action";
import { GetExtensionContext } from "../v1-compat/get-extension-context.action";

export interface ToggleCommandMenuOptions {
  behavior: "open" | "close" | "toggle";
  showShortcutBanner?: boolean;
}

export const ToggleCommandMenu = UnoOrchestrator.registerAction({
  id: "toggle-command-menu",
  zone: Zone.Content,
  async execute(input: ToggleCommandMenuOptions): Promise<void> {
    const { orchestrator, store } = this.context;
    const { layers } = await store.getState();

    const existingCommandMenu = layers[orchestrator.runtimeInfo.tabID]?.find((layer) => {
      const currentLocation = layer.history.entries[layer.history.index];
      return isMatch(currentLocation, [Path.CommandMenu, Path.CommandSubmenu]);
    });

    // Creates the command menu w/latest extension context hydrated
    const doOpen = async () => {
      const extensionContext = await orchestrator.useAction(GetExtensionContext)();
      await store.setState((state) => {
        return {
          ...state,
          v1: { ...state.v1, extensionContext },
        };
      });
      // @start V1_COMPAT
      await orchestrator.useAction(CloseAllOtherV1Modals)({
        v1ExtensionContext: extensionContext,
      });
      // @end V1_COMPAT
      await orchestrator.useAction(CreateLayer)({
        path: Path.CommandMenu,
        searchParams: input.showShortcutBanner ? { showShortcutBanner: "true" } : undefined,
      });
      await orchestrator.useAction(CreateAnalyticsEvent)({
        type: LegacyAnalyticsEvent.CmdMenuOpened,
      });
    };

    // Removes the command menu
    const doClose = async (id: string) => {
      await orchestrator.useAction(RemoveLayer)({ id });
    };

    switch (input.behavior) {
      case "open":
        if (!existingCommandMenu) {
          await doOpen();
        }
        break;

      case "close":
        if (existingCommandMenu) {
          await doClose(existingCommandMenu.id);
        }
        break;

      case "toggle":
      default:
        // Toggle command menu
        if (existingCommandMenu) {
          await doClose(existingCommandMenu.id);
        } else {
          await doOpen();
        }
        break;
    }
  },
});
