import { UnoOrchestrator } from "@/v2/orchestrator";

import { ToggleDebugMode } from "./toggle-debug-mode.action";

UnoOrchestrator.registerGlobalHotkey({
  pattern: "ctrl+shift+d, command+shift+d",
  async onActivate(orchestrator) {
    await orchestrator.useAction(ToggleDebugMode)();
  },
});
