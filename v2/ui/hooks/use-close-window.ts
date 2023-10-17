import { useCallbackConst } from "usable-react";

import { ClosePopup } from "@/v2/actions/browser/close-popup.action";
import { CloseTab } from "@/v2/actions/browser/close-tab.action";
import { Zone } from "@/v2/orchestrator";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";

/**
 * @returns a memoized callback which closes the tab identified by `tabID`.
 */
export function useCloseWindow() {
  const { orchestrator } = useUnoOrchestrator();
  return useCallbackConst(async (tabID?: number | null | "popup") => {
    if (tabID != null) {
      if (tabID === "popup") {
        if (orchestrator.zone === Zone.Popup) {
          // Shortcut: we can skip the action if we're already in a "Popup" zone
          window.close();
        } else {
          await orchestrator.useAction(ClosePopup)();
        }
      } else {
        await orchestrator.useAction(CloseTab)({ tabID });
      }
    }
  });
}

/**
 * @returns a memoized callback which closes the current tab as identified by the
 * nearest contextual `UnoOrchestrator` instance. If we're in a zone without a known
 * tab ID, then the callback is no-op.
 */
export function useCloseCurrentWindow() {
  const { orchestrator } = useUnoOrchestrator();
  return useCallbackConst(async () => {
    if (orchestrator.zone === Zone.Popup) {
      window.close();
    } else if (orchestrator.runtimeInfo?.tabID != null) {
      await orchestrator.useAction(CloseTab)({
        tabID: orchestrator.runtimeInfo?.tabID,
      });
    }
  });
}
