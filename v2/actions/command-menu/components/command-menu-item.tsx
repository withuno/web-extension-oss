import { useCallback, useEffect, useRef } from "react";

import { clsx } from "clsx";

import { Hotkey, HotkeyHandler } from "@/v2/orchestrator/hotkeys";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";

import { ItemMetadata, useCommandMenuContext } from "./command-menu-context";

export interface CommandMenuItemProps {
  id: string;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  embellishment?: React.ReactNode;
  searchShortcut?: string;
  searchAliases?: string[];
  onActivate: () => void;
}

export function CommandMenuItem(props: CommandMenuItemProps) {
  const { id, label, subLabel, icon, embellishment, searchShortcut, searchAliases = [], onActivate } = props;

  const { root } = useUnoOrchestrator();

  // Glean stateful context from `<CommandMenuShell>`.
  const { searchText, shellRef, registerItem, deregisterItem, allVisibleItems, selectedItemID, selectItem, disabled } =
    useCommandMenuContext();

  // References the root `<button>` element of this component.
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Register / de-register this item as-needed.
  useEffect(() => {
    const metadata: ItemMetadata = {
      searchLabel: label,
      searchShortcut,
      searchAliases,
    };
    registerItem(id, metadata);
    return () => {
      deregisterItem(id, metadata);
    };
  }, [searchText, id, label, searchShortcut, JSON.stringify(searchAliases)]);

  // Scroll this item into view as-needed.
  useEffect(() => {
    if (selectedItemID === id && buttonRef.current && shellRef.current) {
      if (itemNeedsScrolling(buttonRef.current, shellRef.current)) {
        buttonRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [id, selectedItemID, buttonRef, shellRef]);

  // Select this item if the pointer moves over it or the button receives focus.
  const handleSelect = useCallback(() => {
    selectItem(id);
  }, [id, selectItem]);

  // Invoke `onActivate` via keyboard, but only when this item is selected & no
  // other interactive buttons are focused in the menu.
  const handleKeyboardActivate = useCallback<HotkeyHandler>(() => {
    if (selectedItemID === id && !(root.activeElement instanceof HTMLButtonElement)) {
      onActivate?.();
    }
  }, [id, selectedItemID, onActivate]);

  // Decide if this item should render based on the current search field state.
  const shouldRender = allVisibleItems.has(id);

  // Early-return if this item should be hidden
  if (!shouldRender) {
    return null;
  }

  return (
    <Hotkey pattern="enter" onActivate={handleKeyboardActivate} disabled={disabled}>
      <button
        className={clsx(
          "m-[4px] flex min-h-[60px] w-[calc(100%-8px)] cursor-pointer scroll-m-[4px] items-center rounded-xl p-4 first:scroll-mt-[66px] focus:outline-none",
          selectedItemID === id && "bg-gray-100",
        )}
        onClick={onActivate}
        onMouseEnter={handleSelect}
        onFocus={handleSelect}
        ref={buttonRef}
      >
        <div className="flex w-[20px] shrink-0 justify-end text-black">{icon}</div>

        <div className="ml-5 mr-3 flex grow flex-col text-left text-[11px] font-semibold">
          {!!embellishment && <div>{embellishment}</div>}
          <div className="text-black">{label}</div>
          {!!subLabel && <div className="font-normal text-[#717280]">{subLabel}</div>}
        </div>

        {searchShortcut ? (
          <div className="rounded bg-[#B0FF00] px-1 py-0.5 text-[9px] font-semibold text-black">{searchShortcut}</div>
        ) : (
          <div>
            <svg width="7" height="9" viewBox="0 0 7 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6.0166 4.47461C6.0166 4.27441 5.94336 4.1084 5.78711 3.95215L2.02734 0.275391C1.90039 0.148438 1.74902 0.0898438 1.56836 0.0898438C1.20215 0.0898438 0.904297 0.37793 0.904297 0.744141C0.904297 0.924805 0.982422 1.09082 1.11426 1.22266L4.4541 4.46973L1.11426 7.72656C0.982422 7.8584 0.904297 8.01953 0.904297 8.20508C0.904297 8.57129 1.20215 8.86426 1.56836 8.86426C1.74902 8.86426 1.90039 8.80078 2.02734 8.67383L5.78711 4.99707C5.94824 4.84082 6.0166 4.6748 6.0166 4.47461Z"
                fill="black"
              />
            </svg>
          </div>
        )}
      </button>
    </Hotkey>
  );
}

/**
 * @returns `true` if the item requires scrolling to stay in-view, `false` otherwise.
 */
function itemNeedsScrolling(item: HTMLButtonElement, shell: HTMLDivElement) {
  const shellTop = shell.scrollTop;
  const shellTopOffset = shell.offsetTop;
  const shellBottom = shellTop + shell.clientHeight;

  const itemTop = item.offsetTop - shellTopOffset;
  const itemBottom = itemTop + item.clientHeight;

  return itemTop < shellTop || itemBottom > shellBottom;
}
