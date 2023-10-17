import type { ExtensionContext } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { ToggleCommandMenu } from "../command-menu/toggle-command-menu.action";

export const CallCommandMenuFn = UnoOrchestrator.registerAction({
  id: "call-command-menu-fn",
  zone: Zone.Content,
  async execute(input: { type: string; v1ExtensionContext?: ExtensionContext | null }): Promise<void> {
    const { orchestrator, store } = this.context;
    const v1ExtensionContext = input.v1ExtensionContext ?? (await store.getState()).v1.extensionContext;

    if (!v1ExtensionContext) {
      return;
    }

    const cmdMenu = await import("@/v1/content/cmd_menu");
    const { callCmdFunction } = await import("@/v1/content/content_script");

    switch (input.type) {
      case cmdMenu.CMD_ID_SETUP_PEEKABOO:
        await callCmdFunction(v1ExtensionContext, input.type);
        await orchestrator.useAction(ToggleCommandMenu)({
          behavior: "close",
        });
        break;

      case cmdMenu.CMD_ID_FEEDBACK:
      case cmdMenu.CMD_ID_GMAIL_SCANNING:
      case cmdMenu.CMD_ID_INVITE_FRIEND:
      case cmdMenu.CMD_ID_SCAN_QR:
      default: {
        await orchestrator.useAction(ToggleCommandMenu)({
          behavior: "close",
        });
        await callCmdFunction(v1ExtensionContext, input.type);
        break;
      }
    }
  },
});
