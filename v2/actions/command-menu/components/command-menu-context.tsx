import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export interface ItemRegisterCallback {
  (id: string, metadata: ItemMetadata): void;
}

export interface ItemVisibilityCallback {
  (id: string): boolean;
}

export interface ItemMetadata {
  searchLabel: string;
  searchAliases?: string[];
  searchShortcut?: string;
}

export interface CommandMenuContext {
  searchText: string;
  shellRef: React.MutableRefObject<HTMLDivElement | null>;
  registerItem: ItemRegisterCallback;
  deregisterItem: ItemRegisterCallback;
  allVisibleItems: Set<string>;
  selectedItemID: string | null;
  selectItem: React.Dispatch<React.SetStateAction<string | null>>;
  selectNextItem: () => void;
  selectPrevItem: () => void;
  disabled: boolean;
}

export const CommandMenuContext = createContext<CommandMenuContext>({
  searchText: "",
  shellRef: { current: null },
  registerItem: () => {},
  deregisterItem: () => {},
  allVisibleItems: new Set<string>(),
  selectedItemID: null,
  selectItem: () => {},
  selectNextItem: () => {},
  selectPrevItem: () => {},
  disabled: false,
});

export function useCommandMenuContext() {
  return useContext(CommandMenuContext);
}

export function useCommandMenuState(disabled = false) {
  const shellRef = useRef<HTMLDivElement | null>(null);

  // --- Search field state --- //

  const [searchText, setSearchText] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const handleSearchTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  }, []);

  // --- Item collection management --- //

  const [allSearchShortcuts, setSearchShortcuts] = useState(new Set<string>());
  const [allVisibleItems, setVisibleItems] = useState(new Set<string>());

  // Registers a `<CommandMenuItem>` child within the scope of this state controller.
  const registerItem = useCallback<ItemRegisterCallback>(
    (id, metadata) => {
      let isVisible = true;
      const searchTextLower = searchText.toLowerCase();
      if (searchTextLower) {
        if (allSearchShortcuts.has(searchTextLower)) {
          isVisible = searchTextLower === metadata.searchShortcut;
        } else {
          isVisible =
            metadata.searchLabel.toLowerCase().includes(searchTextLower) ||
            metadata.searchAliases?.some((alias) => alias.toLowerCase().includes(searchTextLower)) ||
            false;
        }
      }
      if (isVisible) {
        setVisibleItems((curr) => {
          return new Set([...curr, id]);
        });

        if (metadata.searchShortcut) {
          setSearchShortcuts((curr) => {
            return new Set([...curr, metadata.searchShortcut!]);
          });
        }
      }
    },
    [searchText],
  );

  // De-registers a `<CommandMenuItem>` child within the scope of this state controller.
  const deregisterItem = useCallback<ItemRegisterCallback>((id, metadata) => {
    setVisibleItems((curr) => {
      const res = new Set([...curr]);
      res.delete(id);
      return res;
    });

    if (metadata.searchShortcut) {
      setSearchShortcuts((curr) => {
        const res = new Set([...curr]);
        res.delete(metadata.searchShortcut!);
        return res;
      });
    }
  }, []);

  // --- Item selection management --- //

  const [selectedItemID, selectItem] = useState<string | null>(null);

  const selectItemByIncrement = useCallback(
    (i: number) => {
      const visibleItemsArr = [...allVisibleItems.values()];

      const nextSelectedItemIndex = visibleItemsArr.findIndex((id) => id === selectedItemID) + i;
      const nextSelectedItemIndexClamped = Math.min(Math.max(nextSelectedItemIndex, 0), visibleItemsArr.length - 1);

      selectItem(visibleItemsArr[nextSelectedItemIndexClamped]);
    },
    [allVisibleItems, selectedItemID],
  );

  const selectNextItem = useCallback(() => {
    selectItemByIncrement(1);
  }, [selectItemByIncrement]);

  const selectPrevItem = useCallback(() => {
    selectItemByIncrement(-1);
  }, [selectItemByIncrement]);

  // Reset selection when visible items change (e.g.: when the user inputs search text).
  useEffect(() => {
    selectItem(allVisibleItems.values().next().value);
  }, [allVisibleItems]);

  // --- Build & return command menu context --- //

  const ctx = useMemo<CommandMenuContext>(() => {
    return {
      searchText,
      shellRef,
      registerItem,
      deregisterItem,
      allVisibleItems,
      selectedItemID,
      selectItem,
      selectNextItem,
      selectPrevItem,
      disabled,
    };
  }, [
    searchText,
    shellRef,
    registerItem,
    deregisterItem,
    allVisibleItems,
    selectedItemID,
    selectItem,
    selectNextItem,
    selectPrevItem,
    disabled,
  ]);

  return { ctx, searchRef, shellRef, handleSearchTextChange };
}
