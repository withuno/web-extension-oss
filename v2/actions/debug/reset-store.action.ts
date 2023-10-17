import { Zone, UnoOrchestrator } from "../../orchestrator";
import { initialRootState } from "../../store/root-state";

export const ResetStore = UnoOrchestrator.registerAction({
  id: "debug/reset-store",
  zone: Zone.Background,
  async execute(): Promise<void> {
    const { store } = this.context;
    store.resetPersistence();
    await store.setState(() => {
      return { ...initialRootState };
    });
  },
});
