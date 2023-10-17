import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { clsx } from "clsx";
import { useEffectOnce } from "usable-react";

import { UnoOrchestrator } from "@/v2/orchestrator";
import { HotkeyHandler, useGlobalHotkey } from "@/v2/orchestrator/hotkeys";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { UnoLogo } from "@/v2/ui/components/svgs";
import { useBoolean } from "@/v2/ui/hooks/state/use-boolean";
import { useActiveElement } from "@/v2/ui/hooks/use-active-element";
import { useFloatingLayerUpdatePosition, useFloatingLayerReferenceElement } from "@/v2/ui/layers/layer-context";
import { Path } from "@/v2/ui/paths";
import { WithChildren } from "@/v2/ui/prop.types";
import { useSearchParams } from "@/v2/ui/router";
import { EventHandlers } from "@/v2/ui/ui.types";
import { WebDriver } from "@/v2/utils/dom";
import { clamp } from "@/v2/utils/math";

import { FillableDataType } from "./autocomplete.types";
import { HideMagicLoginMenu } from "../magic-login/hide-magic-login-menu.action";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.AutocompleteChip,
  element: <AutocompleteChip />,
}));

function AutocompleteChip() {
  const { orchestrator } = useUnoOrchestrator();

  // --- Glean fillable data ------------------------------------------------ //

  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") as FillableDataType; // TODO: use for debug purposes?
  const rawData = searchParams.getAll("rawData");
  const maskedData = searchParams.getAll("maskedData");

  // --- Input reference state ---------------------------------------------- //

  const layerReference = useFloatingLayerReferenceElement<HTMLInputElement>();
  const [layerReferenceHasValue, setLayerReferenceHasValue] = useBoolean(() => {
    return typeof layerReference?.value === "string" && layerReference?.value.length > 0;
  });

  // When the referenced `<input>` element changes value, set the
  // `layerReferenceHasValue` flag accordingly.
  useEffectOnce(() => {
    if (layerReference) {
      const checkForUserInput = () => {
        setLayerReferenceHasValue.set(typeof layerReference?.value === "string" && layerReference?.value.length > 0);
      };
      layerReference.addEventListener("input", checkForUserInput);
      layerReference.addEventListener("change", checkForUserInput);
      return () => {
        layerReference.removeEventListener("input", checkForUserInput);
        layerReference.removeEventListener("change", checkForUserInput);
      };
    }
  });

  // --- Selection state ---------------------------------------------------- //

  const [index, setIndex] = useState(0);
  const hasNext = useMemo(() => index < rawData.length - 1, [index, rawData.length]);
  const hasPrev = useMemo(() => index > 0, [index]);

  const fillSelection = useCallback(() => {
    if (layerReference && rawData[index]) {
      WebDriver.Keyboard.simulateTyping(layerReference, rawData[index]);
      WebDriver.Field.focusNext(layerReference);

      if (
        [
          FillableDataType.Email,
          FillableDataType.Username,
          FillableDataType.Password,
          FillableDataType.MultiFactorCode,
        ].includes(type)
      ) {
        orchestrator.useAction(HideMagicLoginMenu)(); // Note: we don't need to await this!
      }
    }
  }, [layerReference, rawData[index]]);

  // --- Expanded menu state ------------------------------------------------ //

  const [showExpandedView, setShowExpandedView] = useBoolean(false);
  const expandedViewRef = useRef<HTMLDivElement | null>(null);

  // --- Active-ness state -------------------------------------------------- //

  const [disabled, setDisabled] = useBoolean(false);
  const activeElementInPage = useActiveElement(document);
  const activeElementInContentScripts = useActiveElement();
  const isActive = useMemo(() => {
    return (
      (activeElementInPage === layerReference && !layerReferenceHasValue && rawData.length > 0 && !disabled) ||
      expandedViewRef.current?.contains(activeElementInContentScripts)
    );
  }, [activeElementInPage, activeElementInContentScripts, layerReference, layerReferenceHasValue, rawData, disabled]);

  // Hide the expanded menu if this autocomplete chip becomes inactive.
  useEffect(() => {
    if (!isActive) {
      setShowExpandedView.off();
    }
  }, [isActive]);

  // Update this autocomplete chip's floating position if it becomes active
  const updateFloatingPosition = useFloatingLayerUpdatePosition();
  useEffect(() => {
    if (isActive) {
      updateFloatingPosition();
    }
  }, [isActive]);

  // Re-focus the reference input if the expanded menu is hidden.
  useEffect(() => {
    if (!showExpandedView && isActive) {
      layerReference?.focus();
    }
  }, [showExpandedView]);

  // --- Keyboard interactions ---------------------------------------------- //

  // User presses "RIGHT ARROW" -- increment the selected index.
  useGlobalHotkey("right", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive) {
          e.preventDefault();
          e.stopPropagation();
          setIndex((curr) => clamp(curr + 1, 0, rawData.length - 1));
        }
      },
      [isActive, rawData.length],
    ),
  });

  // User presses "LEFT ARROW" -- decrement the selected index.
  useGlobalHotkey("left", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive) {
          e.preventDefault();
          e.stopPropagation();
          setIndex((curr) => clamp(curr - 1, 0, rawData.length - 1));
        }
      },
      [isActive, rawData.length],
    ),
  });

  // User presses "UP ARROW" -- If the expanded menu is showing, decrement the
  // selected index.
  useGlobalHotkey("up", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive) {
          e.preventDefault();
          e.stopPropagation();
          if (showExpandedView) {
            setIndex((curr) => clamp(curr - 1, 0, rawData.length - 1));
          }
        }
      },
      [isActive, rawData.length, showExpandedView],
    ),
  });

  // User presses "DOWN ARROW" -- one of two cases:
  //  Case #1: If the expanded menu is showing, increment the selected index.
  //  Case #2: If the expanded menu is hidden, show it.
  useGlobalHotkey("down", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive) {
          e.preventDefault();
          e.stopPropagation();
          if (showExpandedView) {
            // Case #1
            setIndex((curr) => clamp(curr + 1, 0, rawData.length - 1));
          } else {
            // Case #2
            setShowExpandedView.on();
          }
        }
      },
      [isActive, rawData.length, showExpandedView],
    ),
  });

  // User presses "ENTER" -- fill the currently selected autocomplete item.
  // TODO: for addresses, logins, or credit cards; fill all the info at once.
  useGlobalHotkey("enter", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive && layerReference) {
          e.preventDefault();
          e.stopPropagation();
          fillSelection();
        }
      },
      [isActive, fillSelection],
    ),
  });

  // User presses "ESC" -- one of two cases:
  //  Case #1: If the expanded menu is showing, hide it.
  //  Case #2: If the expanded menu is hidden, disable this autocomplete chip.
  useGlobalHotkey("esc", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive) {
          e.preventDefault();
          if (showExpandedView) {
            // Case #1
            setShowExpandedView.off();
            layerReference?.focus();
          } else {
            // Case #2
            setDisabled.on();
          }
        }
      },
      [isActive, showExpandedView],
    ),
  });

  // User presses "TAB" -- advance to the next form field.
  useGlobalHotkey("tab", {
    onActivate: useCallback<HotkeyHandler>(
      (e) => {
        if (isActive && showExpandedView && layerReference) {
          e.preventDefault();
          WebDriver.Field.focusNext(layerReference);
        }
      },
      [isActive, layerReference, showExpandedView],
    ),
  });

  // --- Mouse interactions ------------------------------------------------- //

  // If the user clicks on the autocomplete chip itself -- one of two cases:
  //   Case #1: If only one fillable data item is available, fill the selection
  //   right away.
  //   Case #2: Otherwise, toggle the expanded menu.
  const handlePointerDown = useCallback<EventHandlers<"button">["onClick"]>(
    (e) => {
      if (rawData.length === 1 && layerReference) {
        // Case #1
        e.preventDefault();
        e.stopPropagation();
        fillSelection();
      } else if (rawData.length > 1) {
        // Case #2
        e.preventDefault();
        e.stopPropagation();
        setShowExpandedView.toggle();
      }
    },
    [fillSelection, layerReference, rawData.length],
  );

  // --- Render ------------------------------------------------------------- //

  return isActive ? (
    <div className="relative flex h-full w-full flex-row-reverse items-center pr-1.5">
      {/* Inline "autocomplete chip" view */}
      <button
        className="pointer-events-auto flex max-w-[70%] items-center rounded-full border border-black/20 bg-[#F7F8F9] p-1"
        tabIndex={-1}
        onPointerDown={handlePointerDown}
      >
        <UnoLogo className="mr-1 h-[12px] w-[12px] shrink-0" />
        <div className="mr-1 truncate text-[9px]">{maskedData[index]}</div>
        <div className="mr-1.5 flex shrink-0 items-center justify-center space-x-2.5 rounded-[4px] bg-gray-600 px-[3px] pb-[2px] pt-[3px]">
          <span className="text-center text-[7px] font-semibold uppercase text-white">Enter</span>
        </div>

        {rawData.length > 1 && (
          <div className="flex shrink-0 items-center text-[9px]">
            <div className={clsx("-rotate-90", !hasPrev && "opacity-30")}>^</div>
            <div className={clsx("rotate-90", !hasNext && "opacity-30")}>^</div>
          </div>
        )}
      </button>

      {/* Expanded menu view */}
      {showExpandedView && (
        <div
          className="pointer-events-auto absolute right-0 top-full mr-1.5 mt-1 flex min-w-[75px] max-w-xs flex-col items-start rounded-lg border border-black/20 bg-white p-1"
          ref={expandedViewRef}
        >
          {rawData.map((rawDataValue, i) => {
            return (
              <AutocompleteChipExpandedViewItem
                key={`${rawDataValue}:${maskedData[i]}`}
                index={i}
                selectedIndex={index}
                onEnable={setIndex}
                onClick={fillSelection}
              >
                {maskedData[i]}
              </AutocompleteChipExpandedViewItem>
            );
          })}
        </div>
      )}
    </div>
  ) : null;
}

interface AutocompleteChipExpandedViewItemProps extends WithChildren {
  index: number;
  selectedIndex: number;
  onEnable: (index: number) => void;
  onClick: EventHandlers<"button">["onClick"];
}

/**
 * Represents an individual menu item inside the expanded menu view of an
 * autocomplete chip.
 */
function AutocompleteChipExpandedViewItem(props: AutocompleteChipExpandedViewItemProps) {
  const { index, selectedIndex, onEnable, onClick, children } = props;
  const ref = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    if (ref.current && index === selectedIndex) {
      ref.current.focus();
    }
  }, [index, selectedIndex]);

  const handlePointerDown = useCallback(() => {
    onEnable(index);
  }, [index, onEnable]);

  return (
    <button
      tabIndex={-1}
      ref={ref}
      onPointerEnter={handlePointerDown}
      onClick={onClick}
      className="w-full truncate rounded p-1 text-left text-xs focus:bg-[#F7F8F9] focus:outline-none"
    >
      {children}
    </button>
  );
}
