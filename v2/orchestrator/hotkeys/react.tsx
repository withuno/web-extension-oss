import {
  MutableRefObject,
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useUnoStore } from "@/v2/store";

import { hotkeys, HotkeyHandler } from "./instance";
import { useActiveElement } from "../../ui/hooks/use-active-element";
import { Styleable, WithChildren } from "../../ui/prop.types";
import { useUnoOrchestrator } from "../react";

// -------------------------------------------------------------------------- //

interface HotkeyContext {
  activeBoundaryID: MutableRefObject<string | null>;
  scope: string;
  setScope(scope: string): void;
}

const HotkeyContext = createContext<HotkeyContext>({
  activeBoundaryID: { current: null },
  scope: "all",
  setScope: () => {},
});

/**
 * @returns The currently-active `hotkeys` scope.
 */
export function useHotkeyScope() {
  return useContext(HotkeyContext).scope;
}

/**
 * Provides a default `hotkeys` scope for this React tree.
 */
export function HotkeyProvider(props: WithChildren) {
  const [scope, setScope] = useState<string>("all");
  const activeBoundaryID = useRef<string | null>(null);

  // Set the current `hotkeys` scope whenever a descendent `HotKeyBoundary` is
  // rendered. When this `HotKeyProvider` is un-mounted, return to the current
  // scope set on the preview `HotKeyProvider` present in the tree.
  useLayoutEffect(() => {
    hotkeys.setScope(scope);
  }, [scope]);

  // Set up the context object for this `HotKeyProvider` tree.
  const ctx: HotkeyContext = useMemo(() => {
    return {
      scope,
      setScope,
      activeBoundaryID,
    };
  }, [scope, activeBoundaryID]);

  return <HotkeyContext.Provider value={ctx}>{props.children}</HotkeyContext.Provider>;
}

// -------------------------------------------------------------------------- //

const HotkeyBoundaryContext = createContext<string | null>(null);

export interface HotkeyBoundaryProps extends WithChildren, Styleable {
  scope: string;
}

/**
 * Provides a boundary in the React tree that sets the active `hotkeys` scope
 * based on whether the currently-active ("focused") DOM element is descendent.
 */
export function HotkeyBoundary(props: HotkeyBoundaryProps) {
  const { scope, className, style, children } = props;

  const { setScope, activeBoundaryID } = useContext(HotkeyContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const boundaryID = useId();
  const activeElement = useActiveElement();
  const { orchestrator } = useUnoOrchestrator();
  const activeLayer = useUnoStore((state) => {
    return orchestrator.runtimeInfo?.tabID ? state.layers[orchestrator.runtimeInfo.tabID]?.[0] : undefined;
  });

  const activateScope = useCallback(() => {
    activeBoundaryID.current = boundaryID;
    setScope(scope);
  }, [activeBoundaryID, scope]);

  const deactivateScope = useCallback(() => {
    activeBoundaryID.current = null;
    setScope("all");
  }, [activeBoundaryID]);

  const handleInteraction = useCallback(() => {
    activateScope();
  }, [activateScope]);

  // If `enabled === "autodetect"`:
  //   Check if the active layer ID is assigned to `props.scope`, then set the
  //   `hotkeys` scope. Upon un-mount, reset the hotkeys scope to the default
  //   ("all").
  useLayoutEffect(() => {
    if (scope === activeLayer?.id) {
      activateScope();
      return deactivateScope;
    }
  }, [activeLayer]);

  // If `enabled === "autodetect" || enabled === true`:
  //   Check if the active element is descendent, then set the `hotkeys` scope.
  //   Upon un-mount, reset the hotkeys scope to the default ("all").
  useLayoutEffect(() => {
    if (!activeBoundaryID.current) {
      if (ref.current && activeElement && ref.current.contains(activeElement)) {
        activateScope();
        return deactivateScope;
      }
    }
  }, [ref, activeBoundaryID, activeElement, activateScope, deactivateScope]);

  return (
    <HotkeyBoundaryContext.Provider value={scope}>
      <div
        id={boundaryID}
        className={className}
        style={style}
        onPointerDown={handleInteraction}
        onPointerEnter={handleInteraction}
        ref={ref}
      >
        {children}
      </div>
    </HotkeyBoundaryContext.Provider>
  );
}

export interface HotkeyOptions {
  disabled?: boolean;
  onActivate?: HotkeyHandler;
  splitKey?: string; // default: "+"
}

export interface HotkeyProps extends WithChildren, HotkeyOptions {
  pattern?: string;
}

/**
 * Binds a hot-key pattern to some handler logic (as defined by
 * `props.onActivate`).
 */
export function Hotkey(props: HotkeyProps) {
  const { pattern, disabled, onActivate, splitKey, children } = props;
  useHotkey(pattern, { disabled, onActivate, splitKey });
  return <>{children}</>;
}

/**
 * Binds a hot-key pattern to some handler logic (as defined by
 * `options.onActivate`).
 */
export function useHotkey(pattern?: string, options: HotkeyOptions = {}) {
  const { disabled = false, onActivate, splitKey } = options;

  const localScope = useContext(HotkeyBoundaryContext);
  const globalScope = useContext(HotkeyContext).scope;
  const resolvedScope = localScope === null ? globalScope : localScope;

  // Bind a hotkey to the current scope
  // (as defined by the closest `HotKeyBoundary`).
  useLayoutEffect(() => {
    if (!disabled && pattern && onActivate) {
      const handler = (...args: Parameters<HotkeyHandler>) => {
        onActivate(...args);
      };
      hotkeys(pattern, { scope: resolvedScope, splitKey }, handler);
      return () => {
        hotkeys.unbind(pattern, resolvedScope, handler);
      };
    }
  }, [disabled, resolvedScope, pattern, onActivate, splitKey]);
}

/**
 * Binds a globally-registered hot-key pattern to some handler logic (as defined
 * by `options.onActivate`).
 */
export function useGlobalHotkey(pattern?: string, options: HotkeyOptions = {}) {
  const { disabled = false, onActivate, splitKey } = options;

  // Bind a hotkey to the current scope
  // (as defined by the closest `HotKeyBoundary`).
  useLayoutEffect(() => {
    if (!disabled && pattern && onActivate) {
      const handler = (...args: Parameters<HotkeyHandler>) => {
        onActivate(...args);
      };
      hotkeys(pattern, { scope: "all", splitKey }, handler);
      return () => {
        hotkeys.unbind(pattern, "all", handler);
      };
    }
  }, [disabled, pattern, onActivate, splitKey]);
}
