import { useCallback, useEffect } from "react";

import { clsx } from "clsx";

import { E2E } from "@/e2e";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { KeyboardArrowController } from "@/v2/ui/components/keyboard-arrow-controller";
import { UnoLogo } from "@/v2/ui/components/svgs";
import { useCloseLayer, useLayerFocus } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { WithChildren } from "@/v2/ui/prop.types";
import { useNavigate } from "@/v2/ui/router";

import { CommandMenuContext, useCommandMenuState } from "./command-menu-context";

export interface CommandMenuRootProps extends WithChildren, E2E.TestTarget {
  variant: "menu" | "submenu";
  disabled?: boolean;
}

// TODO: Make this "aria"-compliant (e.g.: combo-box)
export function CommandMenuShell(props: CommandMenuRootProps) {
  const { variant, disabled, children } = props;

  const { ctx, searchRef, shellRef, handleSearchTextChange } = useCommandMenuState(disabled);
  const { selectNextItem, selectPrevItem } = ctx;

  const close = useCloseLayer();
  const navigate = useNavigate();
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const { isFocused } = useLayerFocus();
  useEffect(() => {
    if (searchRef.current) {
      if (isFocused) {
        searchRef.current.focus();
      } else {
        searchRef.current.blur();
      }
    }
  }, [isFocused]);

  const handleEsc = useCallback(() => {
    switch (variant) {
      case "submenu": {
        goBack();
        break;
      }

      case "menu":
      default: {
        close();
      }
    }
  }, [variant, goBack, close]);

  return (
    <Hotkey pattern="esc" onActivate={handleEsc} disabled={disabled}>
      <KeyboardArrowController
        onUp={selectPrevItem}
        onDown={selectNextItem}
        onLeft={selectPrevItem}
        onRight={selectNextItem}
      >
        <CommandMenuContext.Provider value={ctx}>
          <div className={clsx("w-[290px]", disabled && "opacity-75")} {...E2E.TestTarget(props)}>
            <div className="m-4 flex">
              {variant === "menu" && <UnoLogo className="h-[20px] w-[20px]" />}

              {variant === "submenu" && (
                <button className="h-[20px] w-[20px]" aria-label="Go back" onClick={goBack}>
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M0.679688 5.76953C0.679688 5.91406 0.707031 6.04883 0.761719 6.17383C0.816406 6.29492 0.904297 6.41406 1.02539 6.53125L5.45508 10.8672C5.63477 11.0469 5.85156 11.1367 6.10547 11.1367C6.27734 11.1367 6.43359 11.0938 6.57422 11.0078C6.71875 10.9258 6.83398 10.8145 6.91992 10.6738C7.00586 10.5332 7.04883 10.377 7.04883 10.2051C7.04883 9.94727 6.94727 9.7168 6.74414 9.51367L2.88281 5.76367L6.74414 2.01953C6.94727 1.82422 7.04883 1.5957 7.04883 1.33398C7.04883 1.16211 7.00586 1.00586 6.91992 0.865234C6.83398 0.724609 6.71875 0.613281 6.57422 0.53125C6.43359 0.445312 6.27734 0.402344 6.10547 0.402344C5.85156 0.402344 5.63477 0.490234 5.45508 0.666016L1.02539 5.00195C0.908203 5.11914 0.822266 5.24023 0.767578 5.36523C0.712891 5.48633 0.683594 5.62109 0.679688 5.76953Z"
                      fill="#C6C8CC"
                    />
                  </svg>
                </button>
              )}

              <input
                className="mx-4 grow bg-transparent text-xs focus:outline-none disabled:bg-transparent"
                autoFocus
                placeholder="Type something..."
                disabled={disabled}
                onChange={handleSearchTextChange}
                ref={searchRef}
              />

              <Modal.CloseButton />
            </div>

            {/* Separator */}
            <div className="h-[1px] bg-black/10" role="presentation" />

            <div className="h-[360px] overflow-auto" ref={shellRef}>
              {children}
            </div>
          </div>
        </CommandMenuContext.Provider>
      </KeyboardArrowController>
    </Hotkey>
  );
}
