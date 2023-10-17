import {
  cloneElement,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { useIsPresent } from "framer-motion";
import * as pathToRegExp from "path-to-regexp";
import { useCallbackConst, useEffectOnce, useValueRef } from "usable-react";
import { v4 as uuid } from "uuid";

import { AnimatePresencePropagated } from "./components/animate-presence-propagated";
import { IntrinsicElementProps } from "./ui.types";
import { ensureArray } from "../utils/arrays";
import { clamp } from "../utils/math";

// ---- History state ------------------------------------------------------- //

export enum Action {
  Pop,
  Push,
  Replace,
  Redirect,
}

export namespace History {
  export interface State {
    location: URL;
    action: Action;
    delta: number;
    direction: -1 | 0 | 1;
  }

  export interface Listener {
    (update: History.State): void;
  }

  export interface NavigateOptions {
    replace?: boolean;
  }

  export interface Navigate {
    (to?: string, options?: NavigateOptions): void;
    (delta?: number): void;
  }
}

export interface History {
  state: History.State;
  subscribe(listener: History.Listener): () => void;
  getSnapshot(): History.State;
  push(to: string): void;
  replace(to: string): void;
  redirect(to: string): void;
  go(delta: number): void;
  onPopState?(e: PopStateEvent): void;
}

export interface MemoryHistoryOptions {
  initialIndex: number;
  initialEntries?: Array<string | URL>;
}

/**
 * @returns a History object that manages location state for the router
 * in-memory.
 */
export function createMemoryHistory(options: MemoryHistoryOptions) {
  const { initialEntries = ["/"], initialIndex } = options;
  const entries = initialEntries.map(createMemoryLocation);

  let index = clamp(initialIndex == null ? entries.length - 1 : initialIndex, 0, entries.length - 1);

  let state: History.State = {
    location: entries[initialIndex],
    action: Action.Pop,
    delta: 0,
    direction: 0,
  };

  const listeners = new Set<History.Listener>();

  function createMemoryLocation(to: string | URL) {
    return new URL(to, "http://localhost");
  }

  const history: History = {
    get state() {
      return state;
    },

    push(to) {
      index += 1;
      state = {
        location: createMemoryLocation(to),
        action: Action.Push,
        delta: 1,
        direction: 1,
      };
      entries.splice(index, entries.length, state.location);
      listeners.forEach((listener) => {
        listener(state);
      });
    },

    replace(to) {
      state = {
        location: createMemoryLocation(to),
        action: Action.Replace,
        delta: 0,
        direction: 0,
      };
      entries[index] = state.location;
      listeners.forEach((listener) => {
        listener(state);
      });
    },

    redirect(to) {
      state = {
        location: createMemoryLocation(to),
        action: Action.Redirect,
        delta: 0,
        direction: 1,
      };
      entries[index] = state.location;
      listeners.forEach((listener) => {
        listener(state);
      });
    },

    go(delta) {
      const nextIndex = clamp(index + delta, 0, entries.length - 1);
      index = nextIndex;
      state = {
        location: entries[nextIndex],
        action: Action.Pop,
        delta,
        direction: Math.sign(delta) as History.State["direction"],
      };
      listeners.forEach((listener) => {
        listener(state);
      });
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    getSnapshot() {
      return state;
    },
  };

  return history;
}

/**
 * @returns a History object that manages location state for the router
 * using the "hash" fragment of `window.history` APIs.
 */
export function createHashHistory() {
  let index = getIndex();
  let state: History.State = {
    location: createHashLocation().forState,
    action: window.history.state?.action ?? Action.Pop,
    delta: window.history.state?.delta ?? 0,
    direction: window.history.state?.direction ?? 0,
  };

  const listeners = new Set<History.Listener>();

  function getIndex(): number {
    const index = window.history.state?.idx;
    if (index == null) {
      window.history.replaceState(
        {
          action: window.history.state?.action ?? Action.Pop,
          delta: window.history.state?.delta ?? 0,
          direction: window.history.state?.direction ?? 0,
          idx: 0,
        },
        "",
      );
    }
    return index ?? 0;
  }

  function createHashLocation(to?: string | URL) {
    const baseURL = window.location.origin + window.location.pathname;
    const forHistory = to ? new URL(`#${to}`, baseURL) : new URL(`#${window.location.hash.slice(1) || "/"}`, baseURL);
    const forState = to ? new URL(to, baseURL) : new URL(window.location.hash.slice(1) || "/", baseURL);
    return { forHistory, forState };
  }

  const history: History = {
    get state() {
      return state;
    },

    push(to) {
      const nextLocation = createHashLocation(to);
      index = getIndex() + 1;
      state = {
        location: nextLocation.forState,
        action: Action.Push,
        delta: 1,
        direction: 1,
      };

      // try...catch because iOS limits us to 100 pushState calls
      try {
        window.history.pushState(
          {
            action: state.action,
            delta: state.delta,
            direction: state.direction,
            idx: index,
          },
          "",
          nextLocation.forHistory,
        );
      } catch (error) {
        // If the exception is because `state` can't be serialized, let that
        // throw outwards just like a replace call would so we know the cause.
        // https://html.spec.whatwg.org/multipage/nav-history-apis.html#shared-history-push/replace-state-steps
        // https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal
        if (error instanceof DOMException && error.name === "DataCloneError") {
          throw error;
        }

        // We are going to lose state here since the page will refresh...
        window.location.assign(state.location);
      }

      listeners.forEach((listener) => {
        listener(state);
      });
    },

    replace(to) {
      const nextLocation = createHashLocation(to);
      index = getIndex();
      state = {
        location: nextLocation.forState,
        action: Action.Replace,
        delta: 0,
        direction: 0,
      };

      window.history.replaceState(
        {
          action: state.action,
          delta: state.delta,
          direction: state.direction,
          idx: index,
        },
        "",
        nextLocation.forHistory,
      );

      listeners.forEach((listener) => {
        listener(state);
      });
    },

    redirect(to) {
      const nextLocation = createHashLocation(to);
      index = getIndex();
      state = {
        location: nextLocation.forState,
        action: Action.Redirect,
        delta: 0,
        direction: 1,
      };

      window.history.replaceState(
        {
          action: state.action,
          delta: state.delta,
          direction: state.direction,
          idx: index,
        },
        "",
        nextLocation.forHistory,
      );

      listeners.forEach((listener) => {
        listener(state);
      });
    },

    onPopState() {
      const nextLocation = createHashLocation();
      const nextIndex = getIndex();
      const delta = nextIndex - index;
      state = {
        location: nextLocation.forState,
        action: Action.Pop,
        delta,
        direction: Math.sign(delta) as History.State["direction"],
      };
      index = nextIndex;
      listeners.forEach((listener) => {
        listener(state);
      });
    },

    go(delta) {
      window.history.go(delta);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    getSnapshot() {
      return state;
    },
  };

  return history;
}

// ---- Routing components -------------------------------------------------- //

interface RouterContext {
  history: History;
  routes: RouteConfig[];
  matchedRoute?: RouteConfig;
}

const RouterContext = createContext<RouterContext>(null!);
const LayoutKeys = new Map<any, string>();

export interface RouteConfig<Pattern extends string = string> {
  pattern: Pattern;
  layout?: JSX.Element;
  element: JSX.Element;
}

export interface RouterProps {
  history: History;
  routes: RouteConfig[];
}

/**
 * The Router component handles routing and rendering of different pages based
 * on the current URL saved in the provided `history` object.
 *
 * @returns The rendered component or null if there is no matching route.
 */
export function Router(props: RouterProps) {
  const { history, routes } = props;

  // Subscribe to history changes and get the initial snapshot.
  const state = useSyncExternalStore(history.subscribe, history.getSnapshot);

  // Match a route based on the current stateful location.
  const { route: matchedRoute, element } = useMatch(state.location, routes);

  // Create the context object for child components.
  const ctx = useMemo<RouterContext>(() => {
    return { history, routes, matchedRoute };
  }, [history, routes, matchedRoute]);

  // If an `onPopState` listener is present on the given history object, set up
  // a "popstate" event listener on the window.
  useEffect(() => {
    if (history.onPopState) {
      window.addEventListener("popstate", history.onPopState);
      return () => {
        window.removeEventListener("popstate", history.onPopState!);
      };
    }
  });

  return (
    <RouterContext.Provider value={ctx}>
      <AnimatePresencePropagated mode="wait">{element}</AnimatePresencePropagated>
    </RouterContext.Provider>
  );
}

export interface LinkProps extends Omit<IntrinsicElementProps<"a">, "href"> {
  to: string;
  replace?: boolean;
}

/**
 * The Link component is used to navigate to a different URL within the
 * application.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
  const { to: href, onClick, children, replace, target, ...anchorProps } = props;

  const navigate = useNavigate();
  const navigateOptions = useValueRef({ replace });

  const hrefRef = useValueRef(href);
  const isHrefRelative = useMemo(() => {
    const absoluteUrlRegex = /^(?:[a-z+]+:)?\/\//i;
    return !absoluteUrlRegex.test(href);
  }, [href]);
  const isHrefRelativeRef = useValueRef(isHrefRelative);

  const handleClick = useCallbackConst((e) => {
    // Ignores the navigation when clicked using right mouse button or
    // by holding a special modifier key: ctrl, command, win, alt, shift...
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.button !== 0) {
      return;
    }

    onClick?.(e);

    // Prevent the default link behavior and navigate to the specified URL
    if (!e.defaultPrevented) {
      if (isHrefRelativeRef.current) {
        e.preventDefault();
        navigate(hrefRef.current, navigateOptions.current);
      }
    }
  });

  return (
    <a
      href={href}
      onClick={handleClick}
      target={isHrefRelative ? target : target ?? "_blank"}
      {...anchorProps}
      ref={ref}
    >
      {children}
    </a>
  );
});

export interface RedirectProps {
  to: string;
}

/**
 * The Redirect component is used to replace the current to a different URL immediately
 * upon rendering (akin to an HTTP redirect, or at least as close to the same
 * thing as our use-case might allow).
 */
export function Redirect(props: RedirectProps) {
  const { to } = props;
  const { history, routes } = useContext(RouterContext);

  // Immediately replace the current route state (this will trigger a re-render).
  useEffectOnce(() => {
    history.redirect(to);
  });

  return <>{useMatch(to, routes).element}</>;
}

// --- Routing hooks -------------------------------------------------------- //

/**
 * @returns the `RouteConfig` object and it's rendered element that matches the
 * given `location`. This is used internally by `<Router>` and `<Redirect>`.
 */
function useMatch(location: string | Partial<URL> | undefined, routes: RouteConfig[]) {
  // Find the matched route based on the given `location`.
  const matchedRoute = useMemo(() => {
    return routes.find(({ pattern }) => {
      return isMatch(location, pattern);
    });
  }, [location]);

  // Determine a layout key for the matched route.
  // If `layoutKey` is not set and matchedRoute has a layout, generate a new layout key.
  let layoutKey = matchedRoute?.layout?.key ?? LayoutKeys.get(matchedRoute?.layout?.type);
  if (!layoutKey && !!matchedRoute?.layout) {
    layoutKey = uuid();
    LayoutKeys.set(matchedRoute.layout?.type, layoutKey);
  }

  // Clone the matched route's element, wrapped with a layout if one is
  // configured.
  const element = matchedRoute
    ? matchedRoute?.layout
      ? cloneElement(
          matchedRoute.layout,
          { key: matchedRoute.layout.key ?? layoutKey },
          cloneElement(matchedRoute.element, {
            key: matchedRoute.element?.key,
          }),
        )
      : cloneElement(matchedRoute.element, {
          key: matchedRoute.element?.key,
        })
    : null;

  return {
    route: matchedRoute,
    element,
  };
}

/**
 * A custom hook that returns the navigate function for programmatically
 * changing the URL. It retrieves the history object from the `RouterContext`
 * and creates a reference to it for consistent access.
 *
 * @returns A memoized navigate function.
 */
export function useNavigate(): History.Navigate {
  const { history } = useContext(RouterContext);
  const historyRef = useValueRef(history);

  return useCallbackConst((to?: string | number, options?: History.NavigateOptions) => {
    if (!to) {
      return;
    }
    if (typeof to === "string") {
      if (options?.replace) {
        historyRef.current.replace(to);
      } else {
        historyRef.current.push(to);
      }
    } else {
      historyRef.current.go(to);
    }
  });
}

/**
 * @returns the current state of the nearest contextual `<Router>`.
 */
export function useRouterState() {
  const { history } = useContext(RouterContext);
  return useSyncExternalStore(history.subscribe, history.getSnapshot);
}

/**
 * @returns `true` if the provided `location` can match any of the provided path
 * `patterns`; `false` otherwise.
 */
export function useMatcher(patterns: string | string[]) {
  const { location } = useRouterState();
  return useMemo(() => {
    return isMatch(location, patterns);
  }, [location]);
}

/**
 * A custom hook that returns the parameters extracted from the current URL
 * path. It retrieves the `matchedRoute` and `location` from the `RouterContext`
 * and `useRouterState` respectively.
 *
 * @returns The parameters extracted from the URL path.
 */
export function useParams(): any {
  const { matchedRoute } = useContext(RouterContext);
  const { location } = useRouterState();
  return useMemo(() => {
    if (!matchedRoute?.pattern) {
      return {};
    }
    const matchPath = pathToRegExp.match(matchedRoute?.pattern);
    const match = matchPath(location.pathname);
    return match ? match.params : {};
  }, [location]);
}

/**
 * A custom hook that returns the `URLSearchParams` object and a function to set
 * the search parameters. It accepts an optional `defaultInit` parameter that
 * can be used to set default search parameters.
 *
 * @returns A tuple containing the `URLSearchParams` object and the set
 * function.
 */
export function useSearchParams(defaultInit?: URLSearchParamsInit): [URLSearchParams, SetURLSearchParams] {
  const defaultSearchParamsRef = useRef(createSearchParams(defaultInit));
  const hasSetSearchParamsRef = useRef(false);

  const { location } = useRouterState();
  const searchParams = useMemo(
    () =>
      // Only merge in the defaults if we haven't yet called setSearchParams.
      // Once we call that we want those to take precedence, otherwise you can't
      // remove a param with setSearchParams({}) if it has an initial value
      getSearchParamsForLocation(
        location.search,
        hasSetSearchParamsRef.current ? null : defaultSearchParamsRef.current,
      ),
    [location.search],
  );

  const locationRef = useValueRef(location);
  const searchParamsRef = useValueRef(searchParams);

  const navigate = useNavigate();
  const setSearchParams = useCallbackConst<SetURLSearchParams>((nextInit, navigateOptions) => {
    const newSearchParams = createSearchParams(
      typeof nextInit === "function" ? nextInit(searchParamsRef.current) : nextInit,
    );
    hasSetSearchParamsRef.current = true;
    navigate(`${locationRef.current.pathname}?${newSearchParams}`, navigateOptions);
  });

  // If the current route component is mounted according to "framer-motion",
  // then the previous `URLSearchParams` reference is preserved. This is useful
  // for maintaining the current UI state throughout animated transitions
  // between routes.
  const isPresent = useIsPresent();
  const preservedSearchParams = useRef(searchParams);
  useEffect(() => {
    if (isPresent) {
      preservedSearchParams.current = searchParams;
    }
  }, [isPresent, location]);

  return [isPresent ? searchParams : preservedSearchParams.current, setSearchParams];
}

export type SetURLSearchParams = (
  nextInit?: URLSearchParamsInit | ((prev: URLSearchParams) => URLSearchParamsInit),
  navigateOpts?: History.NavigateOptions,
) => void;

// --- Routing utilities ---------------------------------------------------- //

/**
 * @returns `true` if the provided `location` can match any of the provided path
 * `patterns`; `false` otherwise.
 */
export function isMatch(location: string | Partial<URL> | undefined, patterns: string | string[]) {
  if (!location) {
    return false;
  }
  return ensureArray(patterns).some((pattern) => {
    const matchPath = pathToRegExp.match(pattern);
    if (typeof location === "string") {
      return matchPath(location.split("?")[0]);
    }
    if (location.pathname) {
      return matchPath(location.pathname);
    }
    return false;
  });
}

export type PathParam<Path extends string> = Path extends "*" | "/*"
  ? "*"
  : Path extends `${infer Rest}/*`
  ? "*" | _PathParam<Rest>
  : _PathParam<Path>;

type _PathParam<Path extends string> = Path extends `${infer L}/${infer R}`
  ? _PathParam<L> | _PathParam<R>
  : Path extends `:${infer Param}`
  ? Param extends `${infer Optional}?`
    ? Optional
    : Param
  : never;

/**
 * A utility function that generates a URL path based on a pattern and it's
 * derived parameters.
 */
export function generatePath<Pattern extends string>(
  pattern: Pattern,
  params?: {
    [key in PathParam<Pattern>]: string | null;
  },
) {
  return pathToRegExp.compile(pattern)(params);
}

export type URLSearchParamsInit =
  | string
  | undefined
  | Array<[string, string | boolean | undefined]>
  | Record<string, string | boolean | undefined | Array<string | boolean | undefined>>
  | URLSearchParams;

/**
 * Create `URLSearchParams` from a (potentially) partial initialization object.
 */
export function createSearchParams(...inits: URLSearchParamsInit[]) {
  const searchParamsList = inits.map((init) => {
    if (init instanceof URLSearchParams || typeof init === "string") {
      return new URLSearchParams(init);
    } else if (typeof init === "undefined") {
      return new URLSearchParams({});
    } else if (Array.isArray(init)) {
      const nextParams = new URLSearchParams();
      init
        .filter((pair) => {
          if (typeof pair[1] === "boolean") {
            return pair[1];
          }
          return pair[1] != null;
        })
        .forEach(([key, value]) => {
          nextParams.append(key, String(value));
        });
      return nextParams;
    } else {
      const nextParams = new URLSearchParams();

      Object.keys(init).forEach((key) => {
        const value = init[key];
        if (value == null) {
          return;
        } else if (Array.isArray(value)) {
          value
            .filter((v) => {
              if (typeof v === "boolean") {
                return v;
              }
              return typeof v != null;
            })
            .forEach((v) => {
              nextParams.append(key, String(v));
            });
          return;
        } else if (typeof value === "boolean") {
          if (value) {
            nextParams.set(key, String(value));
          }
        } else {
          nextParams.set(key, String(value));
        }
      });

      return nextParams;
    }
  });

  return searchParamsList.reduce((result, curr) => {
    curr.forEach((val, key) => {
      result.append(key, val);
    });
    return result;
  }, new URLSearchParams());
}

/**
 * @returns the number of unique keys are contained in the given `searchParams`.
 */
export function countSearchParams(searchParams: URLSearchParams) {
  const keys = new Set();
  searchParams.forEach((_, key) => {
    if (!keys.has(key)) {
      keys.add(key);
    }
  });
  return keys.size;
}

function getSearchParamsForLocation(locationSearch: string, defaultSearchParams: URLSearchParams | null) {
  const searchParams = createSearchParams(locationSearch);

  if (defaultSearchParams) {
    defaultSearchParams.forEach((_, key) => {
      if (!searchParams.has(key)) {
        defaultSearchParams.getAll(key).forEach((value) => {
          searchParams.append(key, value);
        });
      }
    });
  }

  return searchParams;
}
