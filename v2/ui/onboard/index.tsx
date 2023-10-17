import "./css/normalize.css";
import "./css/webflow.css";
import "./css/extension-pages.webflow.css";

import { useReducer, Fragment } from "react";

import { messageToJSON, messageFromJSON, EmailStatus, UnoError } from "@/v1/uno_types";
import { createAnalyticsEvent } from "@/v1/utils";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

import Done from "./Done";
import ErrorPage from "./ErrorPage";
import SignedIn from "./SignedIn";
import SignIn from "./SignIn";
import SignUp from "./SignUp";
import { Path } from "../paths";

enum Page {
  Init,
  Error,
  SignIn,
  SignUp,
  SignedIn,
  Done,
}

type StateType = {
  visiblePage: Page;
  failureCode: UnoError;
  sessionSeed: string | undefined;
  existingEmail: string | undefined;
  emailSent: boolean;
};

const searchParams = new URLSearchParams(window.location.search);
const initialState: StateType = {
  visiblePage: searchParams.has("skipToEnd") ? Page.Done : Page.SignUp,
  failureCode: UnoError.None,
  sessionSeed: undefined,
  existingEmail: undefined,
  emailSent: false,
};

type ActionType =
  | { type: "click_refresh" }
  | { type: "set_existing_email"; payload: string }
  | { type: "set_email_sent"; payload: boolean }
  | { type: "set_visible_page"; payload: Page }
  | { type: "session_recovered" }
  | { type: "create_session_received"; payload: string }
  | { type: "set_failure_code"; payload: UnoError };

function reducer(state: typeof initialState, action: ActionType) {
  switch (action.type) {
    case "set_existing_email":
      return {
        ...state,
        existingEmail: action.payload,
      };
    case "set_email_sent":
      return {
        ...state,
        emailSent: action.payload,
      };
    case "set_visible_page":
      return {
        ...initialState,
        existingEmail: state.existingEmail,
        visiblePage: action.payload,
      };
    case "create_session_received":
      return {
        ...state,
        sessionSeed: action.payload,
      };
    case "session_recovered":
      return {
        ...state,
        visiblePage: Page.SignedIn,
      };
    case "click_refresh":
      return initialState;
    case "set_failure_code":
      return {
        ...state,
        visiblePage: Page.Error,
        failureCode: action.payload,
      };
  }
}

export function OnboardApp() {
  const [state, dispatch] = useReducer(reducer, initialState);

  function handleClickRefresh(): boolean {
    dispatch({ type: "click_refresh" });
    return false;
  }

  function handleClickSignUp(e: any) {
    e.preventDefault();
    dispatch({ type: "set_visible_page", payload: Page.SignUp });
    return false;
  }

  function handleSessionStart() {
    chrome.runtime.sendMessage(messageToJSON({ kind: "NATIVE_BOOTSTRAP" }), function (r) {
      try {
        const message = messageFromJSON(r);

        switch (message.kind) {
          case "ERROR":
            // XXX: should switch on error type here.
            return chrome.runtime.sendMessage(messageToJSON({ kind: "START_SESSION" }), function (r) {
              try {
                const message = messageFromJSON(r);

                switch (message.kind) {
                  case "ERROR":
                    return dispatch({
                      type: "set_failure_code",
                      payload: message.payload,
                    });
                  case "SESSION_CREATED":
                    return dispatch({
                      type: "create_session_received",
                      payload: message.payload,
                    });
                  default:
                    throw new Error(`Unexpected message kind ${message.kind}`);
                }
              } catch (e) {
                console.error(e);
                return dispatch({
                  type: "set_failure_code",
                  payload: UnoError.Unknown,
                });
              }
            });
          case "SESSION_RECOVERED":
            dispatch({ type: "session_recovered" });
            break;
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (e) {
        console.error(e);
        return dispatch({
          type: "set_failure_code",
          payload: UnoError.Unknown,
        });
      }
    });
  }

  function handleCreate(email: string | null): Promise<boolean> {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(messageToJSON({ kind: "CREATE_VAULT", payload: email }), function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "ERROR":
              dispatch({
                type: "set_failure_code",
                payload: message.payload,
              });

              return resolve(false);
            case "CREATE_VAULT_SUCCESS":
              return resolve(true);
          }
        } catch (e) {
          dispatch({
            type: "set_failure_code",
            payload: UnoError.Unknown,
          });

          return resolve(false);
        }
      });
    });
  }

  function handleCreateWithoutEmail() {
    handleCreate(null).then(function () {
      // dispatch({ type: "set_visible_page", payload: Page.Done });
      handleAiAssistOnboarding();
    });

    return false;
  }

  function handleGetEmailStatus(email: string): Promise<EmailStatus> {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(messageToJSON({ kind: "GET_EMAIL_STATUS", payload: email }), function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "ERROR":
              return reject(message.payload);
            case "EMAIL_STATUS_SUCCESS":
              return resolve(message.payload);
            default:
              return reject(UnoError.Unknown);
          }
        } catch (e) {
          return reject(e);
        }
      });
    });
  }

  function handleCreateWithEmail(email: string) {
    handleCreate(email).then(function () {
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "START_EMAIL_VERIFY",
        }),
        function (r) {
          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "START_EMAIL_VERIFY_SUCCESS":
                dispatch({ type: "set_email_sent", payload: true });
                // dispatch({ type: "set_visible_page", payload: Page.Done });
                handleAiAssistOnboarding();
                break;
              case "ERROR":
                dispatch({
                  type: "set_failure_code",
                  payload: UnoError.Unknown,
                });
            }
          } catch (e) {
            dispatch({ type: "set_failure_code", payload: UnoError.Unknown });
          }
        },
      );
    });

    return false;
  }

  function handleSessionPoll() {
    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_SESSION" }), function (r) {
      try {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "ERROR":
            return dispatch({
              type: "set_failure_code",
              payload: message.payload,
            });
          case "SESSION_RECOVERY_PENDING":
            break;
          case "SESSION_RECOVERED":
            createAnalyticsEvent(LegacyAnalyticsEvent.OnboardSignInQR);
            dispatch({ type: "session_recovered" });
            break;
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (e) {
        console.error(e);
        return dispatch({
          type: "set_failure_code",
          payload: UnoError.Unknown,
        });
      }
    });
  }

  function handleClickSignIn(e: any) {
    e.preventDefault();

    dispatch({ type: "set_visible_page", payload: Page.SignIn });

    return false;
  }

  function handleAiAssistOnboarding() {
    // @start V2_COMPAT
    const onboardBase = chrome.runtime.getURL("pages.html");
    window.location.assign(`${onboardBase}#${Path.AiAssistConsentPage}?onboard=true`);
    // @end V2_COMPAT
  }

  const page = (function () {
    switch (state.visiblePage) {
      case Page.Init:
        return <div />;
      case Page.Error:
        return <ErrorPage failureCode={state.failureCode} handleClickRefresh={handleClickRefresh} />;
      case Page.SignIn:
        return (
          <SignIn
            globalFailure={(e: UnoError) => {
              dispatch({ type: "set_failure_code", payload: e });
            }}
            success={() => {
              createAnalyticsEvent(LegacyAnalyticsEvent.OnboardSignInPrivateKey);
              dispatch({ type: "session_recovered" });
            }}
            clickSignUp={handleClickSignUp}
            sessionSeed={state.sessionSeed}
            sessionStart={handleSessionStart}
            sessionPoll={handleSessionPoll}
            startOver={handleCreateWithEmail}
            existingEmail={state.existingEmail}
          />
        );
      case Page.SignUp:
        return (
          <SignUp
            globalFailure={(e: UnoError) => {
              dispatch({ type: "set_failure_code", payload: e });
            }}
            clickSignIn={handleClickSignIn}
            gotoSignIn={(existing_email: string) => {
              dispatch({ type: "set_existing_email", payload: existing_email });
              dispatch({ type: "set_visible_page", payload: Page.SignIn });
            }}
            getEmailStatus={handleGetEmailStatus}
            createWithEmail={handleCreateWithEmail}
            createWithoutEmail={handleCreateWithoutEmail}
          />
        );
        break;
      case Page.Done:
        return <Done />;
      case Page.SignedIn:
        return <SignedIn />;
      default:
        break;
    }
  })();

  return <>{page}</>;
}
