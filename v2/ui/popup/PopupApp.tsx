import React, { useReducer, useEffect, Fragment } from "react";

import { E2E } from "@/e2e";
import {
  messageToJSON,
  messageFromJSON,
  VaultItemId,
  UnoError,
  VerifiedStatus,
  VisibleVaultItem,
  CreateQuery,
  SchemaType,
  UpdateQuery,
  VaultSuccess,
  VisibleVaultItemBySchemaType,
} from "@/v1/uno_types";
import { CacheBustContentScriptSiteItems } from "@/v2/actions/vault/populate-site-items.action";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";

import AddDevice from "./AddDevice";
import AddressItemAdd from "./AddressItemAdd";
import AddressItemEdit from "./AddressItemEdit";
import AddressItemView from "./AddressItemView";
import AiAssistSettings from "./AiAssistSettings";
import CreditCardItemAdd from "./CreditCardItemAdd";
import CreditCardItemEdit from "./CreditCardItemEdit";
import CreditCardItemView from "./CreditCardItemView";
import Delete from "./Delete";
import Index from "./Index";
import LoginItemAdd from "./LoginItemAdd";
import LoginItemEdit from "./LoginItemEdit";
import LoginItemView from "./LoginItemView";
import Logout from "./Logout";
import style from "./popup.modules.css";
import PrivateKeyItemAdd from "./PrivateKeyItemAdd";
import PrivateKeyItemEdit from "./PrivateKeyItemEdit";
import PrivateKeyItemView from "./PrivateKeyItemView";
import SecureNoteItemAdd from "./SecureNoteItemAdd";
import SecureNoteItemEdit from "./SecureNoteItemEdit";
import SecureNoteItemView from "./SecureNoteItemView";
import Settings from "./Settings";
import ViewSeed from "./ViewSeed";
import VisibleError from "./VisibleError";

enum Page {
  Error,
  Index,
  LoginItemAdd,
  LoginItemEdit,
  LoginItemView,
  CreditCardItemAdd,
  CreditCardItemEdit,
  CreditCardItemView,
  AddressItemAdd,
  AddressItemEdit,
  AddressItemView,
  PrivateKeyItemAdd,
  PrivateKeyItemEdit,
  PrivateKeyItemView,
  SecureNoteItemAdd,
  SecureNoteItemEdit,
  SecureNoteItemView,
  Delete,
  Settings,
  Init,
  ViewSeed,
  Verify,
  AddDevice,
  Logout,
  AiAssistSettings,
}

type StateType = {
  networkBusy: boolean;
  errorMessage: string | null;
  activeVaultItem: VaultItemId | null;
  clientOutOfDate: boolean;
  needsOnboard: boolean;
  previouslyVisiblePage: Page;
  visiblePage: Page;
  verifiedStatus: VerifiedStatus;
  vault: VaultSuccess | undefined;
  vaultEmail: string | undefined;
};

const initialState: StateType = {
  vaultEmail: undefined,
  networkBusy: false,
  errorMessage: null,
  activeVaultItem: null,
  clientOutOfDate: false,
  needsOnboard: false,
  previouslyVisiblePage: Page.Index,
  visiblePage: Page.Index,
  verifiedStatus: VerifiedStatus.Unknown,
  vault: undefined,
};

type ActionType =
  | { type: "set_vault_email"; payload: string | undefined }
  | { type: "set_network_busy"; payload: boolean }
  | { type: "click_ai_assist_settings" }
  | { type: "click_refresh" }
  | { type: "click_settings" }
  | { type: "click_index" }
  | { type: "click_delete"; payload: VaultItemId }
  | { type: "click_show_login"; payload: VaultItemId }
  | { type: "click_add_login" }
  | { type: "click_edit_login"; payload: VaultItemId }
  | { type: "click_show_credit_card"; payload: VaultItemId }
  | { type: "click_add_credit_card" }
  | { type: "click_edit_credit_card"; payload: VaultItemId }
  | { type: "click_show_address"; payload: VaultItemId }
  | { type: "click_add_address" }
  | { type: "click_edit_address"; payload: VaultItemId }
  | { type: "click_show_private_key"; payload: VaultItemId }
  | { type: "click_add_private_key" }
  | { type: "click_edit_private_key"; payload: VaultItemId }
  | { type: "click_show_secure_note"; payload: VaultItemId }
  | { type: "click_add_secure_note" }
  | { type: "click_edit_secure_note"; payload: VaultItemId }
  | { type: "click_view_seed" }
  | { type: "click_add_device" }
  | { type: "click_logout" }
  | { type: "set_out_of_date"; payload: boolean }
  | { type: "needs_onboard" }
  | { type: "show_onboard" }
  | { type: "set_failure_code"; payload: UnoError }
  | { type: "set_verified_status"; payload: VerifiedStatus }
  | { type: "set_vault"; payload: VaultSuccess };

function errorMessageFromCode(code: UnoError): string {
  switch (code) {
    case UnoError.VaultNeedsSync:
      return "Your vault has changed since it was last opened. Please refresh and try again.";
    case UnoError.ClientOutOfDate:
      return "Your extension needs to be updated to continue to make changes.";
    case UnoError.NetworkError:
      return "We are having trouble connecting to Uno. Please check your connection settings and try again.";
    default:
      return "Something has gone wrong.";
  }
}

function reducer(state: typeof initialState, action: ActionType) {
  // TODO: why does this need to happen here?
  const previouslyVisiblePage = state.visiblePage;

  switch (action.type) {
    case "set_vault_email":
      return {
        ...state,
        previouslyVisiblePage,
        vaultEmail: action.payload,
      };
    case "set_network_busy":
      return {
        ...state,
        previouslyVisiblePage,
        networkBusy: action.payload,
      };
    case "set_vault":
      return {
        ...state,
        previouslyVisiblePage,
        vault: action.payload,
      };
    case "set_verified_status":
      return {
        ...state,
        previouslyVisiblePage,
        verifiedStatus: action.payload,
      };
    case "click_view_seed":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.ViewSeed,
      };
    case "click_add_device":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.AddDevice,
      };
    case "click_logout":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.Logout,
      };
    case "click_ai_assist_settings":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.AiAssistSettings,
      };
    case "click_refresh":
      return initialState;
    case "click_delete":
      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: action.payload,
        errorMessage: null,
        visiblePage: Page.Delete,
      };
    case "set_failure_code": {
      const message = errorMessageFromCode(action.payload);

      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: message,
      };
    }
    case "click_settings":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.Settings,
      };
    case "click_index":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.Index,
      };
    case "click_show_login":
      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: action.payload,
        errorMessage: null,
        visiblePage: Page.LoginItemView,
      };
    case "click_add_login": {
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.LoginItemAdd,
      };
    }
    case "click_edit_login": {
      const v = state.activeVaultItem;

      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: v,
        errorMessage: null,
        visiblePage: Page.LoginItemEdit,
      };
    }
    case "click_show_credit_card":
      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: action.payload,
        errorMessage: null,
        visiblePage: Page.CreditCardItemView,
      };
    case "click_add_credit_card": {
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.CreditCardItemAdd,
      };
    }
    case "click_edit_credit_card": {
      const v = state.activeVaultItem;

      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: v,
        errorMessage: null,
        visiblePage: Page.CreditCardItemEdit,
      };
    }
    case "click_show_address":
      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: action.payload,
        errorMessage: null,
        visiblePage: Page.AddressItemView,
      };
    case "click_add_address": {
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.AddressItemAdd,
      };
    }
    case "click_edit_address": {
      const v = state.activeVaultItem;

      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: v,
        errorMessage: null,
        visiblePage: Page.AddressItemEdit,
      };
    }
    case "click_show_private_key":
      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: action.payload,
        errorMessage: null,
        visiblePage: Page.PrivateKeyItemView,
      };
    case "click_add_private_key": {
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.PrivateKeyItemAdd,
      };
    }
    case "click_edit_private_key": {
      const v = state.activeVaultItem;

      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: v,
        errorMessage: null,
        visiblePage: Page.PrivateKeyItemEdit,
      };
    }
    case "click_show_secure_note":
      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: action.payload,
        errorMessage: null,
        visiblePage: Page.SecureNoteItemView,
      };
    case "click_add_secure_note": {
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.SecureNoteItemAdd,
      };
    }
    case "click_edit_secure_note": {
      const v = state.activeVaultItem;

      return {
        ...state,
        previouslyVisiblePage,
        activeVaultItem: v,
        errorMessage: null,
        visiblePage: Page.SecureNoteItemEdit,
      };
    }
    case "set_out_of_date":
      return {
        ...state,
        previouslyVisiblePage,
        clientOutOfDate: action.payload,
      };
    case "show_onboard":
    case "needs_onboard":
      return {
        ...state,
        previouslyVisiblePage,
        errorMessage: null,
        visiblePage: Page.Error,
        needsOnboard: true,
      };
  }
}

function PopupApp() {
  const { orchestrator } = useUnoOrchestrator();
  const [state, dispatch] = useReducer(reducer, initialState);

  function setVerifiedStatus() {
    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_VERIFIED_STATUS" }), function (r) {
      const message = messageFromJSON(r);
      switch (message.kind) {
        case "VERIFIED_STATUS_SUCCESS":
          dispatch({ type: "set_verified_status", payload: message.payload });
          break;
        default:
          // NOTE: we may want to mark this as "ignore" if we can't
          // get the status from the server.
          dispatch({
            type: "set_verified_status",
            payload: VerifiedStatus.Unknown,
          });
          break;
      }
    });
  }

  function setVault(force_sync = false) {
    dispatch({ type: "set_network_busy", payload: true });

    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_VAULT", payload: force_sync }), function (r) {
      dispatch({ type: "set_network_busy", payload: false });

      const message = messageFromJSON(r);
      switch (message.kind) {
        case "GET_VAULT_SUCCESS_OUT_OF_DATE":
          dispatch({
            type: "set_failure_code",
            payload: UnoError.VaultNeedsSync,
          });

          dispatch({ type: "set_vault", payload: message.payload });

          break;
        case "GET_VAULT_SUCCESS":
          orchestrator.useAction(CacheBustContentScriptSiteItems)();
          dispatch({ type: "set_vault", payload: message.payload });
          break;
        case "ERROR":
          if (message.payload == UnoError.NeedsOnboard) {
            dispatch({ type: "needs_onboard" });
            return;
          }

          // Try to load a cached vault and show the original
          // error message.
          dispatch({ type: "set_network_busy", payload: true });
          chrome.runtime.sendMessage(messageToJSON({ kind: "GET_VAULT", payload: false }), function (r) {
            dispatch({ type: "set_network_busy", payload: false });

            const m = messageFromJSON(r);
            switch (m.kind) {
              case "GET_VAULT_SUCCESS_OUT_OF_DATE":
              case "GET_VAULT_SUCCESS":
                dispatch({ type: "set_vault", payload: m.payload });
                break;
              default:
                break;
            }

            dispatch({
              type: "set_failure_code",
              payload: message.payload,
            });
          });
          break;
        default:
          dispatch({ type: "set_failure_code", payload: UnoError.Unknown });
          break;
      }
    });
  }

  useEffect(() => {
    setVerifiedStatus();
    // XXX: This makes two remote vault calls when the popup is loaded
    // instead of just one. Not a big deal but annoying. 6/28/2023 -Chris
    setVault(true);

    return () => {};
  }, []);

  function handleReVerifySubmit(): boolean {
    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "START_EMAIL_VERIFY",
      }),
      function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "START_EMAIL_VERIFY_SUCCESS":
              dispatch({ type: "click_index" });

              break;
            case "ERROR":
              // XXX:
              // globalFailure(message.payload as UnoError);
              break;
          }
        } catch (e) {
          // globalFailure(UnoError.Unknown);
        }
      },
    );

    return false;
  }

  function handleVerifySubmit(e: React.FormEvent): boolean {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      email: { value: string };
    };

    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "UPDATE_VAULT_EMAIL",
        payload: target.email.value,
      }),
      function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "UPDATE_VAULT_EMAIL_SUCCESS":
              return handleReVerifySubmit();
            case "ERROR":
              switch (message.payload) {
                case UnoError.NeedsOnboard:
                  dispatch({ type: "needs_onboard" });
                  break;
                default:
                  // XXX:
                  // globalFailure(message.payload as UnoError);
                  break;
              }

              break;
          }
        } catch (e) {
          // XXX:
          /// globalFailure(UnoError.Unknown);
        }
      },
    );

    return false;
  }

  function handleClickAiAssistSettings(): boolean {
    dispatch({ type: "click_ai_assist_settings" });
    return false;
  }

  function handleClickRefresh(): boolean {
    dispatch({ type: "click_refresh" });
    return false;
  }

  function handleClickLogout(): boolean {
    dispatch({ type: "click_logout" });

    return false;
  }

  function handleClickConfirmLogout(): boolean {
    dispatch({ type: "needs_onboard" });

    chrome.runtime.sendMessage(messageToJSON({ kind: "REMOVE_ACCOUNT" }));

    return false;
  }

  function handleClickIndex() {
    dispatch({ type: "click_index" });
  }

  function handleClickViewSeed() {
    dispatch({ type: "click_view_seed" });
  }

  function handleClickAddDevice() {
    dispatch({ type: "click_add_device" });
  }

  function handleClickEdit(v: VaultItemId, type: SchemaType) {
    dispatch({ type: `click_edit_${type}` as const, payload: v });
  }

  function handleClickItem(v: VaultItemId, type: SchemaType) {
    dispatch({ type: `click_show_${type}` as const, payload: v });
  }

  function handleClickDelete(v: VaultItemId) {
    dispatch({ type: "click_delete", payload: v });
  }

  function handleDelete(v: VaultItemId): Promise<void> {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "DELETE_VAULT_ITEM",
          payload: v,
        }),
        function (r) {
          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "ERROR":
                dispatch({
                  type: "set_failure_code",
                  payload: message.payload,
                });
                return reject();
              case "VAULT_ACTION_SUCCESS":
                setVault();
                return resolve();
            }
          } catch (e) {
            dispatch({ type: "set_failure_code", payload: UnoError.Unknown });
            return reject();
          }
        },
      );
    });
  }

  function handleUpdate(t: SchemaType, q: UpdateQuery): Promise<void> {
    dispatch({ type: "set_network_busy", payload: true });

    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "UPDATE_VAULT_ITEM",
          payload: {
            schema_type: t,
            item: q,
          },
        }),
        function (r) {
          dispatch({ type: "set_network_busy", payload: false });

          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "ERROR":
                dispatch({
                  type: "set_failure_code",
                  payload: message.payload,
                });
                return reject();
              case "VAULT_ACTION_SUCCESS":
                setVault();
                return resolve();
            }
          } catch (e) {
            dispatch({ type: "set_failure_code", payload: UnoError.Unknown });
            return reject();
          }
        },
      );
    });
  }

  function handleCreate(t: SchemaType, q: CreateQuery): Promise<void> {
    dispatch({ type: "set_network_busy", payload: true });

    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "CREATE_VAULT_ITEM",
          payload: {
            schema_type: t,
            item: q,
          },
        }),

        function (r) {
          dispatch({ type: "set_network_busy", payload: false });

          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "ERROR":
                dispatch({
                  type: "set_failure_code",
                  payload: message.payload,
                });
                return reject();
              case "VAULT_ACTION_SUCCESS":
                setVault();
                return resolve();
            }
          } catch (e) {
            dispatch({ type: "set_failure_code", payload: UnoError.Unknown });
            return reject();
          }
        },
      );
    });
  }

  function vaultItemById<T extends SchemaType>(
    type: T,
    id: VaultItemId | null,
  ): VisibleVaultItemBySchemaType<T> | null {
    if (id === null) return null;
    if (state.vault === undefined) return null;

    return (
      (state.vault.find((v) => {
        return v.schema_type === type && v.id === id;
      }) as VisibleVaultItemBySchemaType<T>) || null
    );
  }

  // eslint-disable-next-line react/no-unstable-nested-components
  function ItemMissing(props: any) {
    return (
      <div>
        <div>This item is not available right now.</div>
        <div onClick={props.handleClickBack}>Click here to go back.</div>
      </div>
    );
  }

  const error = (
    <>
      <VisibleError message={state.errorMessage} />
    </>
  );

  const page = (function () {
    switch (state.visiblePage) {
      case Page.ViewSeed:
        return <ViewSeed handleClickBack={handleClickIndex} seed="" />;
      case Page.AddDevice:
        return <AddDevice handleClickBack={handleClickIndex} />;
      case Page.Logout:
        return <Logout handleClickBack={handleClickIndex} handleClickConfirmLogout={handleClickConfirmLogout} />;
      case Page.Delete:
        if (state.activeVaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <Delete
            isLogin // XXX: fixme
            handleDelete={handleDelete}
            vaultItemId={state.activeVaultItem}
            networkBusy={state.networkBusy}
            handleClickBack={() => {
              dispatch({ type: "click_index" });
            }}
            handleDone={() => {
              dispatch({ type: "click_index" });
            }}
          />
        );
      case Page.Settings:
        return (
          <Settings
            handleRefresh={() => {
              dispatch({ type: "click_index" });
              setVault(true);
            }}
            handleClickAiAssistSettings={handleClickAiAssistSettings}
            handleClickAddDevice={handleClickAddDevice}
            handleClickViewSeed={handleClickViewSeed}
            handleClickBack={handleClickIndex}
            handleClickLogout={handleClickLogout}
          />
        );
      case Page.Error:
        if (state.needsOnboard) {
          return (
            <div className={style.onboardContainer}>
              <a
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  dispatch({ type: "show_onboard" });
                  chrome.runtime.sendMessage(messageToJSON({ kind: "SHOW_ONBOARD" }));
                }}
              >
                Click here to get started.
              </a>
            </div>
          );
        }

        return <div />;
      case Page.LoginItemView: {
        const vaultItem = vaultItemById<"login">("login", state.activeVaultItem);

        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <LoginItemView
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleClickBack={() => {
              dispatch({ type: "click_index" });
            }}
            handleClickEdit={(v: VisibleVaultItem) => {
              handleClickEdit(v.id, v.schema_type);
            }}
          />
        );
      }
      case Page.LoginItemEdit: {
        const vaultItem = vaultItemById<"login">("login", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }
        return (
          <LoginItemEdit
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleUpdate={handleUpdate}
            handleClickDelete={(e: React.MouseEvent) => {
              e.preventDefault();
              if (state.activeVaultItem !== null) {
                handleClickDelete(state.activeVaultItem);
              }
            }}
            handleClickBack={() => {
              if (state.activeVaultItem !== null) {
                handleClickItem(state.activeVaultItem, "login");
              }
            }}
          />
        );
      }
      case Page.LoginItemAdd:
        return (
          <LoginItemAdd
            handleClickBack={handleClickIndex}
            handleCreate={handleCreate}
            networkBusy={state.networkBusy}
          />
        );

      case Page.CreditCardItemView: {
        const vaultItem = vaultItemById<"credit_card">("credit_card", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <CreditCardItemView
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleClickBack={() => {
              dispatch({ type: "click_index" });
            }}
            handleClickEdit={(v: VisibleVaultItem) => {
              handleClickEdit(v.id, v.schema_type);
            }}
          />
        );
      }
      case Page.CreditCardItemEdit: {
        const vaultItem = vaultItemById<"credit_card">("credit_card", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <CreditCardItemEdit
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleUpdate={handleUpdate}
            handleClickDelete={(e: React.MouseEvent) => {
              e.preventDefault();
              if (state.activeVaultItem !== null) {
                handleClickDelete(state.activeVaultItem);
              }
            }}
            handleClickBack={() => {
              if (state.activeVaultItem !== null) {
                handleClickItem(state.activeVaultItem, "credit_card");
              }
            }}
          />
        );
      }
      case Page.CreditCardItemAdd:
        return (
          <CreditCardItemAdd
            networkBusy={state.networkBusy}
            handleClickBack={handleClickIndex}
            handleCreate={handleCreate}
          />
        );
      case Page.AddressItemView: {
        const vaultItem = vaultItemById<"address">("address", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <AddressItemView
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleClickBack={() => {
              dispatch({ type: "click_index" });
            }}
            handleClickEdit={(v: VisibleVaultItem) => {
              handleClickEdit(v.id, v.schema_type);
            }}
          />
        );
      }
      case Page.AddressItemEdit: {
        const vaultItem = vaultItemById<"address">("address", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <AddressItemEdit
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleUpdate={handleUpdate}
            handleClickDelete={(e: React.MouseEvent) => {
              e.preventDefault();
              if (state.activeVaultItem !== null) {
                handleClickDelete(state.activeVaultItem);
              }
            }}
            handleClickBack={() => {
              if (state.activeVaultItem !== null) {
                handleClickItem(state.activeVaultItem, "address");
              }
            }}
          />
        );
      }
      case Page.AddressItemAdd:
        return (
          <AddressItemAdd
            networkBusy={state.networkBusy}
            handleClickBack={handleClickIndex}
            handleCreate={handleCreate}
          />
        );

      case Page.PrivateKeyItemView: {
        const vaultItem = vaultItemById<"private_key">("private_key", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <PrivateKeyItemView
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleClickBack={() => {
              dispatch({ type: "click_index" });
            }}
            handleClickEdit={(v: VisibleVaultItem) => {
              handleClickEdit(v.id, v.schema_type);
            }}
          />
        );
      }

      case Page.PrivateKeyItemEdit: {
        const vaultItem = vaultItemById<"private_key">("private_key", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <PrivateKeyItemEdit
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleUpdate={handleUpdate}
            handleClickDelete={(e: React.MouseEvent) => {
              e.preventDefault();
              if (state.activeVaultItem !== null) {
                handleClickDelete(state.activeVaultItem);
              }
            }}
            handleClickBack={() => {
              if (state.activeVaultItem !== null) {
                handleClickItem(state.activeVaultItem, "private_key");
              }
            }}
          />
        );
      }
      case Page.PrivateKeyItemAdd:
        return (
          <PrivateKeyItemAdd
            networkBusy={state.networkBusy}
            handleClickBack={handleClickIndex}
            handleCreate={handleCreate}
          />
        );

      case Page.SecureNoteItemView: {
        const vaultItem = vaultItemById<"secure_note">("secure_note", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <SecureNoteItemView
            networkBusy={state.networkBusy}
            vaultItem={vaultItem}
            handleClickBack={() => {
              dispatch({ type: "click_index" });
            }}
            handleClickEdit={(v: VisibleVaultItem) => {
              handleClickEdit(v.id, v.schema_type);
            }}
          />
        );
      }
      case Page.SecureNoteItemEdit: {
        const vaultItem = vaultItemById<"secure_note">("secure_note", state.activeVaultItem);
        if (vaultItem === null) {
          return (
            <ItemMissing
              handleClickBack={() => {
                dispatch({ type: "click_index" });
              }}
            />
          );
        }

        return (
          <SecureNoteItemEdit
            vaultItem={vaultItem}
            networkBusy={state.networkBusy}
            handleUpdate={handleUpdate}
            handleClickDelete={(e: React.MouseEvent) => {
              e.preventDefault();
              if (state.activeVaultItem !== null) {
                handleClickDelete(state.activeVaultItem);
              }
            }}
            handleClickBack={() => {
              if (state.activeVaultItem !== null) {
                handleClickItem(state.activeVaultItem, "secure_note");
              }
            }}
          />
        );
      }
      case Page.SecureNoteItemAdd:
        return (
          <SecureNoteItemAdd
            networkBusy={state.networkBusy}
            handleClickBack={handleClickIndex}
            handleCreate={handleCreate}
          />
        );

      case Page.Index:
        return (
          <Index
            networkBusy={state.networkBusy}
            vault={state.vault}
            verifiedStatus={state.verifiedStatus}
            handleRefresh={() => {
              setVault(true);
            }}
            handleVerifySubmit={handleVerifySubmit}
            handleReVerifySubmit={handleReVerifySubmit}
            handleClickAdd={(schema_type: SchemaType) => {
              dispatch({ type: `click_add_${schema_type}` });
            }}
            handleClickSettings={() => {
              dispatch({ type: "click_settings" });
            }}
            handleClickItem={(v: VisibleVaultItem) => {
              handleClickItem(v.id, v.schema_type);
            }}
          />
        );
      case Page.Verify:
        return (
          <>
            <div>
              <form onSubmit={handleVerifySubmit}>
                <input placeholder="email" type="email" name="email" />
                <button type="submit">Submit</button>
              </form>
            </div>
          </>
        );
      case Page.Init:
        return (
          <>
            <div className={style.spinnerContainer}>
              <img className={style.spinner} src="../images/popup_spinner.svg" />
            </div>
          </>
        );
      case Page.AiAssistSettings:
        return <AiAssistSettings handleClickBack={handleClickIndex} />;
      default:
        break;
    }
  })();

  return (
    <div
      className={style.container}
      // Slight hack to make the add device page taller.
      style={state.visiblePage === Page.AddDevice ? { height: "590px" } : {}}
      {...E2E.TestTarget(E2E.TestID.PopupRoot)}
    >
      <div style={{ width: "100%" }}>
        {state.errorMessage && error}
        {page}
      </div>
    </div>
  );
}

export default PopupApp;
