import type { ExtensionContext } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const SetExtensionContext = UnoOrchestrator.registerAction({
  id: "set-extension-context",
  zone: Zone.Content,
  async execute(input: { extensionContext: ExtensionContext }): Promise<void> {
    const { messageFromJSON, messageToJSON } = await import("@/v1/uno_types");
    const { setExtensionContext } = await import("@/v1/content/content_script");

    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "UPDATE_EXTENSION_CONTEXT",
        extensionContext: input.extensionContext,
      }),
      async (r) => {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "UPDATE_EXTENSION_CONTEXT_SUCCESS":
            setExtensionContext(message.extensionContext);
            break;
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      },
    );
  },
});
