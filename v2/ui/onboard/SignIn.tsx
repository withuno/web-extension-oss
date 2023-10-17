import React, { useReducer, useEffect } from "react";

import QR from "@/v1/QR";
import { messageToJSON, messageFromJSON, UnoError } from "@/v1/uno_types";

enum SigninState {
  Start,
  Requested,
}

type StateType = {
  signinState: SigninState;
  manualSeed: string;
  failureCode: UnoError;
};

const initialState: StateType = {
  signinState: SigninState.Start,
  manualSeed: "",
  failureCode: UnoError.None,
};

type ActionType =
  | { type: "set_manual_seed"; payload: string }
  | { type: "save_manual_seed_requested" }
  | { type: "save_manual_seed_success" }
  | { type: "save_manual_seed_failed"; payload: UnoError };

function reducer(state: typeof initialState, action: ActionType) {
  switch (action.type) {
    case "set_manual_seed":
      return {
        ...state,
        manualSeed: action.payload,
      };
    case "save_manual_seed_requested":
      return {
        ...state,
        signinState: SigninState.Requested,
        failureCode: UnoError.None,
      };
    case "save_manual_seed_failed":
      return {
        ...state,
        signinState: SigninState.Start,
        failureCode: action.payload,
      };
    case "save_manual_seed_success":
      return initialState;
  }
}

export default function (props: any) {
  let timeoutTimer: any;

  const [state, dispatch] = useReducer(reducer, initialState);

  function saveManualSeed(e: any): boolean {
    e.preventDefault();

    dispatch({ type: "save_manual_seed_requested" });

    chrome.runtime.sendMessage(messageToJSON({ kind: "TRANSFER_SHARE", payload: state.manualSeed }), function (r) {
      try {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "ERROR":
            if (message.payload == UnoError.NeedsOnboard) {
              return dispatch({
                type: "save_manual_seed_failed",
                payload: UnoError.NeedsOnboard,
              });
            }

            return props.globalFailure(message.payload);
          case "SESSION_RECOVERED":
            dispatch({ type: "save_manual_seed_success" });
            return props.success();
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (e) {
        return props.globalFailure(e);
      }
    });

    return false;
  }

  function handleChangeManualSeed(e: React.FormEvent): boolean {
    e.preventDefault();

    const target = e.target as typeof e.target & {
      value: string;
    };

    dispatch({ type: "set_manual_seed", payload: target.value });

    return false;
  }

  function doPoll() {
    props.sessionPoll();

    timeoutTimer = setTimeout(function () {
      doPoll();
    }, 2000);
  }

  useEffect(function () {
    props.sessionStart();

    return () => {};
  }, []);

  useEffect(
    function () {
      if (props.sessionSeed !== undefined) {
        doPoll();
      }

      return () => {
        clearTimeout(timeoutTimer);
      };
    },
    [props.sessionSeed],
  );

  return (
    <div className="w-row">
      <div className="signin-left w-col w-col-6">
        <a href="#" onClick={props.clickSignUp} className="backbutton w-button">
          Back
        </a>
        <img src="images/signin.svg" loading="lazy" alt="" className="image" />
        <div className="text-block">© 2023 WithUno, Inc.</div>
      </div>
      <div className="signin-right w-col w-col-6">
        <div className="div-block-2">
          <div className="div-block">
            <h4 className="heading">Welcome back</h4>
            <div className="text-block-2">Pick a way to sign back into your Uno account</div>
          </div>
          <div className="privatekeylogin">
            <div className="div-block-4">
              <img src="images/key.svg" loading="lazy" height="16" alt="" className="image-2" />
              <h5 className="heading-2">Login with Private Key</h5>
            </div>
            <div className="privatekey w-form">
              <div>{state.failureCode == UnoError.NeedsOnboard ? "Sorry, we couldn't find that account." : ""}</div>
              <form
                id="email-form"
                name="email-form"
                data-name="Email Form"
                method="get"
                className="form"
                onSubmit={saveManualSeed}
              >
                <input
                  type="text"
                  className="text-field w-input"
                  maxLength={256}
                  name="Enter-your-private-key"
                  data-name="Enter your private key"
                  placeholder="Enter your private key"
                  id="Enter-your-private-key"
                  required
                  onChange={handleChangeManualSeed}
                  value={state.manualSeed}
                />
                <input
                  type="submit"
                  disabled={state.signinState == SigninState.Requested}
                  value={state.signinState == SigninState.Requested ? "Please wait..." : "Sign in"}
                  data-wait="Please wait..."
                  className="submit-button w-button"
                />
              </form>
            </div>
          </div>
          <div className="qrcodelogin">
            <div className="div-block-4">
              <img src="images/scan.svg" loading="lazy" height="16" alt="" className="image-3" />
              <h5 className="heading-2">Login with QR code</h5>
            </div>
            <div className="div-block-6">
              <div className="text-block-2">
                <span>
                  1. Open the Uno app.
                  <br />
                  2. Go to settings
                  <br />
                  3. Select Add Another Device
                  <br />
                  4. Scan QR Code
                </span>
              </div>
              <div className="div-block-5">
                {!props.sessionSeed && <img src="../images/popup_spinner.svg" />}
                {props.sessionSeed && <QR onError={props.handleError} data={props.sessionSeed} />}
              </div>
            </div>
          </div>
          {props.existingEmail !== undefined && (
            <div className="startover">
              <div className="div-block-4">
                <img src="images/create_new.svg" loading="lazy" height="16" alt="" className="image-3" />
                <h5 className="heading-2">Create a new account instead</h5>
              </div>
              <div className="div-block-6">
                <div className="text-block-2">
                  <span>
                    <a
                      onClick={(e) => {
                        e.preventDefault();
                        if (props.existingEmail !== undefined) {
                          props.startOver(props.existingEmail);
                        }

                        return false;
                      }}
                      className="startoverlink"
                      href="#"
                    >
                      Start over with a fresh Uno account.
                    </a>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
