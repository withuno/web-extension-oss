import { Path } from "@/v2/ui/paths";

import { Zone, UnoOrchestrator } from "../../orchestrator";
import { OpenPage } from "../browser/open-page.action";

const WHATS_NEW_VERSION = 1;

export const OpenWhatsNew = UnoOrchestrator.registerAction({
  id: "whats-new/open",
  zone: Zone.Background,
  async execute(): Promise<void> {
    const { orchestrator, store } = this.context;
    const { lastSeenVersion } = (await store.getState()).whatsNew;

    if (lastSeenVersion == null || lastSeenVersion < WHATS_NEW_VERSION) {
      await orchestrator.useAction(OpenPage)({ path: Path.WhatsNew });
    }

    await store.setState((state) => {
      return {
        ...state,
        whatsNew: {
          lastSeenVersion: WHATS_NEW_VERSION,
        },
      };
    });
  },
});
