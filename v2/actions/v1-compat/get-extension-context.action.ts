import type { ExtensionContext } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const GetExtensionContext = UnoOrchestrator.registerAction({
  id: "get-extension-context",
  zone: Zone.Content,
  async execute(input?: { updateVault?: boolean }): Promise<ExtensionContext> {
    const { messageFromJSON, messageToJSON } = await import("@/v1/uno_types");

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "GET_EXTENSION_CONTEXT",
          currentLocation: window.location,
          updateVault: input?.updateVault ?? false,
        }),
        async (r) => {
          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "GET_EXTENSION_CONTEXT_SUCCESS":
                resolve(message.extensionContext);
                break;
              default:
                reject(new Error(`Unexpected message kind ${message.kind}`));
            }
          } catch (e) {
            reject(e);
          }
        },
      );
    });
  },
});
