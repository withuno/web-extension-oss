import { Zone, UnoOrchestrator } from "../../orchestrator";
import { GetExtensionContext } from "../v1-compat/get-extension-context.action";
import { SetExtensionContext } from "../v1-compat/set-extension-context.action";

export const ToggleDebugMode = UnoOrchestrator.registerAction({
  id: "debug/toggle-debug-mode",
  zone: Zone.Background,
  async execute(): Promise<void> {
    const { orchestrator, store } = this.context;
    await store.setState((state) => {
      return {
        ...state,
        debugMode: !state.debugMode,
      };
    });

    // @start V1_COMPAT
    const extensionContext = await orchestrator.useAction(GetExtensionContext)();
    await orchestrator.useAction(SetExtensionContext)({
      extensionContext: {
        ...extensionContext,
        debugMode: !extensionContext.debugMode,
      },
    });
    // @end V1_COMPAT
  },
});
