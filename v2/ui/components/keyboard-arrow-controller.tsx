import { useCallback } from "react";

import { Hotkey, HotkeyHandler } from "@/v2/orchestrator/hotkeys";

import { WithChildren } from "../prop.types";

export namespace KeyboardArrowController {
  export interface Handler {
    (): void;
  }

  export interface Props extends WithChildren {
    onUp?: Handler;
    onDown?: Handler;
    onLeft?: Handler;
    onRight?: Handler;
    onX?: Handler;
    onY?: Handler;
    onEnter?: Handler;
    disabled?: boolean;
  }
}

export function KeyboardArrowController(props: KeyboardArrowController.Props) {
  const { onUp, onDown, onLeft, onRight, onX, onY, onEnter, disabled, children } = props;

  const handleActivateUp = useCallback<HotkeyHandler>(() => {
    onUp?.();
    onY?.();
  }, [onUp, onY]);

  const handleActivateDown = useCallback<HotkeyHandler>(() => {
    onDown?.();
    onY?.();
  }, [onDown, onY]);

  const handleActivateLeft = useCallback<HotkeyHandler>(() => {
    onLeft?.();
    onX?.();
  }, [onLeft, onX]);

  const handleActivateRight = useCallback<HotkeyHandler>(() => {
    onRight?.();
    onX?.();
  }, [onRight, onX]);

  const handleActivateEnter = useCallback<HotkeyHandler>(() => {
    onEnter?.();
  }, [onEnter]);

  return (
    <Hotkey pattern="up" onActivate={handleActivateUp} disabled={disabled}>
      <Hotkey pattern="down" onActivate={handleActivateDown} disabled={disabled}>
        <Hotkey pattern="left" onActivate={handleActivateLeft} disabled={disabled}>
          <Hotkey pattern="right" onActivate={handleActivateRight} disabled={disabled}>
            <Hotkey pattern="enter" onActivate={handleActivateEnter} disabled={disabled}>
              {children}
            </Hotkey>
          </Hotkey>
        </Hotkey>
      </Hotkey>
    </Hotkey>
  );
}
