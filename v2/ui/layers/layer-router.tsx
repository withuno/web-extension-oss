import { useLayoutEffect } from "react";

import { useValueRef } from "usable-react";

import { SyncPopUpdate } from "@/v2/actions/layers/history/sync-pop-update.action";
import { SyncPushUpdate } from "@/v2/actions/layers/history/sync-push-update.action";
import { SyncRedirectUpdate } from "@/v2/actions/layers/history/sync-redirect-update.action";
import { SyncReplaceUpdate } from "@/v2/actions/layers/history/sync-replace-update.action";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";

import type { Layer, LayerSearchParams } from "../../store/slices/layer.slice";
import { Action, Router, type History, type RouteConfig, URLSearchParamsInit, createSearchParams } from "../router";

export interface LayerRouterProps {
  layer: Layer;
  history: History;
  routes: RouteConfig[];
}

/**
 * Routes the current in-page layer to the appropriate element function.
 */
export function LayerRouter(props: LayerRouterProps) {
  const { layer, history, routes } = props;

  const layerRef = useValueRef(layer);
  const { orchestrator } = useUnoOrchestrator();

  useLayoutEffect(() => {
    return history.subscribe((evt) => {
      switch (evt.action) {
        case Action.Pop: {
          orchestrator.useAction(SyncPopUpdate)({
            layer: layerRef.current,
            update: evt,
          });
          break;
        }

        case Action.Push: {
          orchestrator.useAction(SyncPushUpdate)({
            layer: layerRef.current,
            update: evt,
          });
          break;
        }

        case Action.Replace: {
          orchestrator.useAction(SyncReplaceUpdate)({
            layer: layerRef.current,
            update: evt,
          });
          break;
        }

        case Action.Redirect: {
          orchestrator.useAction(SyncRedirectUpdate)({
            layer: layerRef.current,
            update: evt,
          });
          break;
        }
      }
    });
  }, [history]);

  return <Router history={history} routes={routes} />;
}

export function createLayerSearchParams(layerSearchParams: LayerSearchParams, ...inits: URLSearchParamsInit[]) {
  return createSearchParams(layerSearchParams as URLSearchParamsInit, ...inits);
}
