import { UnoOrchestrator } from "@/v2/orchestrator";

import { ToggleCommandMenu } from "./toggle-command-menu.action";

UnoOrchestrator.registerGlobalHotkey({
  pattern: "ctrl+shift+k, command+shift+k",
  async onActivate(orchestrator) {
    await orchestrator.useAction(ToggleCommandMenu)({ behavior: "toggle" });
  },
});
