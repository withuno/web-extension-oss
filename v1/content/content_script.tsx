import { LoginTarget } from "@withuno/locust";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Canvg } from "canvg";
import creditCardType from "credit-card-type";
import { CreditCardType } from "credit-card-type/dist/types";
import dedent from "dedent";
import parseURI from "otpauth-uri-parser";
import UAParser from "ua-parser-js";
import { v4 as uuidv4 } from "uuid";

// V2 Architecture
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";
import { OpenMagicLoginMenu } from "@/v2/actions/magic-login/open-magic-login-menu.action";
import { OpenPasswordGenerator } from "@/v2/actions/password-generator/open-password-generator.action";
import { ViewSaveAddressHint } from "@/v2/actions/product-hints/save-address-hint.action";
import { ViewSaveCreditCardHint } from "@/v2/actions/product-hints/save-credit-card-hint.action";
import { ViewSaveLoginHint } from "@/v2/actions/product-hints/save-login-hint.action";
import { GenerateOneTimeCodeFromSeed } from "@/v2/actions/vault/generate-totp.action";
import type { UnoOrchestrator, Zone } from "@/v2/orchestrator";
import { UnoStore } from "@/v2/store";
import { isDemoHost as isDemoHostV2 } from "@/v2/ui/hooks/use-demo-host";
import { generateCssSelector } from "@/v2/utils/css";

import {
  InputWithType,
  findInputsOfType,
  INPUT_TYPE_CREDIT_CARD_NUMBER,
  INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE,
  INPUT_TYPE_CREDIT_CARD_CVC,
  INPUT_TYPE_CREDIT_CARD_HOLDER_NAME,
  INPUT_TYPE_STREET_ADDRESS,
  onlyNumbers,
  doAutofillForCard,
  generateCardName,
  doAutofillForAddress,
  INPUT_TYPE_CITY,
  INPUT_TYPE_ZIP_CODE,
  INPUT_TYPE_STATE,
  INPUT_TYPE_COUNTRY,
  INPUT_TYPE_ADDRESS_LINE_2,
} from "./autocomplete";
import { AMEX, DINERS_CLUB, DISCOVER, GENERIC, JCB, MAESTRO, MASTERCARD, UNION_PAY, VISA } from "./cc_badge_svgs";
import * as cmdMenu from "./cmd_menu";
import * as commonSVGs from "./common_svgs";
import { gotEmailFromCurrentDomain, getMessages, getBody, archiveEmail } from "./gmail";
import { decodeString } from "../base32";
import {
  messageToJSON,
  messageFromJSON,
  ExtensionContext,
  LoginItem,
  SupportedSSOProviders,
  VaultItemId,
  SSODetails,
} from "../uno_types";
import { createAnalyticsEvent, isSafari } from "../utils";

let v2Orchestrator: UnoOrchestrator<Zone.Content> | null = null;
export function injectV2UnoOrchestrator(orchestrator: UnoOrchestrator<Zone.Content>) {
  v2Orchestrator = orchestrator;
}

// If the user Xs out magic login, keep it closed (until content script is reloaded)
let keepMagicLoginClosed = false;
// @start V2_COMPAT
export const getKeepMagicLoginClosed = () => keepMagicLoginClosed;
export const setKeepMagicLoginClosed = (val: boolean) => (keepMagicLoginClosed = val);
// @end V2_COMPAT

let keepSuggestStrongPWClosed = false;
// @start V2_COMPAT
export const getKeepSuggestStrongPWClosed = () => keepSuggestStrongPWClosed;
export const setKeepSuggestStrongPWClosed = (val: boolean) => (keepSuggestStrongPWClosed = val);
// @end V2_COMPAT

let keepAutofillClosed = false;
let saveLoginSaved = false;

let keepReconnectClosed = false;
let authTriggered = false;
// We occasionally get failures which don't mean we're disconnected.  Try buffering them a bit.
let failedGmailCalls = 0;

// When we find a qr code, stop searching
let searchForQRCodes = true;
let limitScanning = false;

let skipIterations = 0;

// If we've been trying magic login long enough, reset the state
let magicLoginAttempts = 0;
let magicLoginEventListeners: Array<(e: KeyboardEvent) => void> = [];

// eslint-disable-next-line
let modalTimer: NodeJS.Timer | null = null;

// When suggest strong pw is open, we'll try and keep it open
// Reason for this: If a user cancels out of save login, we'll want to bring it back up
let suggestStrongPwOpen = false;
// @start V2_COMPAT
export const getSuggestStrongPwOpen = () => suggestStrongPwOpen;
export const setSuggestStrongPwOpen = (val: boolean) => (suggestStrongPwOpen = val);
// @end V2_COMPAT

let strongPWEntered = false;
// @start V2_COMPAT
export const getStrongPWEntered = () => strongPWEntered;
export const setStrongPWEntered = (val: boolean) => (strongPWEntered = val);
// @end V2_COMPAT

let existingSSOChoices: SSODetails[] = [];
const safari = isSafari();

let haveAddressInput: HTMLInputElement | HTMLSelectElement | null = null;
let haveCCInput: HTMLInputElement | HTMLSelectElement | null = null;

// This is where we store inputs that we find with autocomplete=""
// see: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#values
let inputsOfType: Array<InputWithType> = [];

// @start V2_COMPAT
// GET ContentScriptContext from background script
let extensionContext: ExtensionContext | null = null;
/** Used by V2 Architecture to mutate V1's `extensionContext` variable. */
export function setExtensionContext(updatedExtensionContext: ExtensionContext) {
  extensionContext = updatedExtensionContext;
}
// @end V2_COMPAT

// @start V2_COMPAT
const isDemoHost = isDemoHostV2();
// @end V2_COMPAT

function runWhenDocumentIsReady() {
  // Get chrome extension context from background script
  chrome.runtime.sendMessage(
    messageToJSON({
      kind: "GET_EXTENSION_CONTEXT",
      currentLocation: window.location,
      updateVault: true,
    }),
    async function (r) {
      try {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "GET_EXTENSION_CONTEXT_SUCCESS":
            {
              extensionContext = message.extensionContext;
              existingSSOChoices = getSavedSSOChoices(extensionContext);
              findElements();

              if (extensionContext.gmailScannerSetup && !extensionContext.gmailToken) {
                authTriggered = true;
                getGmailToken();
              }

              // Uncomment these to test out the modals
              // To run the extension normally, comment them all out

              // 1. Save login
              // extensionContext.saveLoginUsername = "mike@twitter.com";
              // await showSaveLoginModal(extensionContext);

              // 2. Magic login
              // await showMagicLoginModal(extensionContext, false, findElements);

              // 3. Missing info
              // extensionContext.saveLoginPassword = "dummypassword!!!@$";
              // extensionContext.saveLoginHostname = window.location.hostname;
              // await showMissingInfoModal(extensionContext);

              // 4. Missing info dupe
              // await showDuplicateFoundModal(extensionContext);

              // 5. Update login
              // extensionContext.saveLoginUsername = "test@gmail.com";
              // extensionContext.saveLoginPassword = "testing123!";
              // await showUpdateLoginModal(extensionContext);

              // 6. 2FA code detected
              // await show2FADetectedModal(extensionContext, "blah");

              // 7. 2FA saved
              // await show2FASavedModal(extensionContext, "blah");

              // 8. Override 2FA modal
              // await showOverride2FAModal(extensionContext, "blah", "");

              // 10. Reconnect gmail modal
              // await showReconnectGmailModal();

              // 11. Email modal
              // await showEmailModal(extensionContext);

              // 12. Show command menu modal

              // 13. Show qr scanning none found modal

              // 14. Show qr scanning modal
              // await showScanningQRCodesModal();
              // await showNoQRCodesFoundModal();

              // 15. Show save credit card modal
              // await showSaveCreditCardModal(extensionContext, false, []);

              // 16. Show autofill credit cards modal
              // await showAutofillCreditCardModal(extensionContext);

              // 17. Show save addresses modal
              // await showSaveAddressModal(extensionContext, [], false);

              // Save login has already been fired but there was a navigation, put it back on the page
              if (
                extensionContext.saveLoginShowing &&
                extensionContext.saveLoginUsername &&
                extensionContext.saveLoginPassword &&
                strongPWEntered === false
              ) {
                let modalTime = 15_000;
                if (extensionContext.modalTickTime) {
                  modalTime = extensionContext.modalTickTime;
                }
                hideMagicLoginModal(extensionContext);
                startModalTimer(modalTime, extensionContext);
                await showSaveLoginModal(extensionContext);
              }

              // Save credit card has already been fired but there was a navigation, put it back on the page
              // Now with the modals being sequenced, we have to check for only cc info, only add info, or both info (and sequence them)
              if (
                extensionContext.saveCCShowing &&
                extensionContext.saveAddShowing === false &&
                extensionContext.saveCCCardNumber
              ) {
                const isExistingCard = cardExists(extensionContext, extensionContext.saveCCCardNumber);
                if (isExistingCard === false) {
                  await showSaveCreditCardModal(extensionContext, false, [], true);
                }
              } else if (extensionContext.saveAddShowing && extensionContext.saveCCShowing === false) {
                await showSaveAddressModal(extensionContext, [], false, true);
              } else if (extensionContext.saveAddShowing && extensionContext.saveCCShowing) {
                // Sequence the save modals.  CC first, which will kick off save add modal
                await showSaveCreditCardModal(extensionContext, true, inputsOfType, true);
              }

              // Missing info showing but there was a navigation, show it.
              if (
                (await UnoStore.getState()).aiAssist.status !== "running" &&
                extensionContext.missingInfoShowing &&
                extensionContext.saveLoginPassword &&
                strongPWEntered === false
              ) {
                hideMagicLoginModal(extensionContext);
                await showMissingInfoModal(extensionContext);
              }

              // Update login showing but there was a navigation, show it.
              if (
                extensionContext.updateLoginShowing &&
                extensionContext.saveLoginUsername &&
                extensionContext.saveLoginPassword &&
                strongPWEntered === false
              ) {
                hideMagicLoginModal(extensionContext);
                await showUpdateLoginModal(extensionContext);
              }

              // Save SSO handled a bit differently:
              // Send message to bg to clear other save ssos
              if (extensionContext.saveSSOShowing) {
                let modalTime = 15_000;
                if (extensionContext.modalTickTime) {
                  modalTime = extensionContext.modalTickTime;
                }

                tellBGToHideOtherSaveSSOs();

                hideMagicLoginModal(extensionContext);
                startModalTimer(modalTime, extensionContext);
                await showSaveLoginModal(extensionContext);
              }

              // If magic login says it's showing, but it's not, update the context
              const magicModal = document.getElementById("uno-magic-modal");
              if (extensionContext.magicLoginShowing && !extensionContext.magicLoginInitiated && !magicModal) {
                extensionContext.magicLoginShowing = false;
                updateExtensionContext(extensionContext);
              }
            }

            break;
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (e) {
        console.error("Error getting extension context", e);
      }
    },
  );

  findElements();
  setInterval(findElements, 1000);
}

// This runs every second
export const findElements = async () => {
  // Only run the loop if the tab is active
  if (document.visibilityState === "visible") {
    const gmailModal = document.getElementById("uno-gmail-container");

    // Gmail stuff
    if (extensionContext && extensionContext.gmailToken && !gmailModal && extensionContext.googleAuthError === false) {
      // if no email, will return null
      const gotEmailResp = await gotEmailFromCurrentDomain(extensionContext.gmailToken);

      if (gotEmailResp.errorCode) {
        failedGmailCalls++;
      }

      if (gotEmailResp.errorCode && gotEmailResp.errorCode === 403) {
        createAnalyticsEvent(LegacyAnalyticsEvent.GmailScan403);
      } // catch a 401 too and reauth
      else if (gotEmailResp.errorCode && gotEmailResp.errorCode === 401) {
        getGmailToken(false);
      } // This would be 2 minutes of failed gmail calls
      else if (gotEmailResp.errorCode && failedGmailCalls > 10) {
        // Right now we see 401s come back from the scanning stuff which prompts the reconnect modal
        // Instead of just assuming the token is bad, let's try and get the token again to see if it needs a refresh
        getGmailToken(false);
      }

      if (gotEmailResp.id && extensionContext.gmailIDsShown.includes(gotEmailResp.id) === false) {
        extensionContext.gmailIDsShown.push(gotEmailResp.id);
        updateExtensionContext(extensionContext);

        // let's hide the ML modal if it's around
        hideMagicLoginModal(extensionContext);
        keepMagicLoginClosed = true;

        await showEmailModal(extensionContext);
        createAnalyticsEvent(LegacyAnalyticsEvent.EmailScannerAutoShowModal);
      }
    }

    // Demo
    const demo2faVerified = document.getElementById("uno-aq-verified-2fa");
    if (demo2faVerified && extensionContext) {
      closeAllOtherModals(extensionContext);
      document.getElementById("uno-2fa-saved-host")?.remove();
      keepMagicLoginClosed = false;
      extensionContext.missingInfoShowing = false;
      updateExtensionContext(extensionContext);
    }

    if (extensionContext && extensionContext.googleAuthError && extensionContext.gmailScannerSetup) {
      // show re-connect modal
      await showReconnectGmailModal();
    }

    if (
      extensionContext &&
      !extensionContext.gmailToken &&
      extensionContext.gmailScannerSetup &&
      authTriggered === false
    ) {
      authTriggered = true;
      getGmailToken();
    }

    // Don't run the loop if we don't have the background context or if save login is showing
    if (extensionContext !== null && extensionContext.saveLoginShowing === false && skipIterations === 0) {
      // Get all the elements we're going to search
      const [inputs, forms, buttons, divs, anchors, iframes, selects] = getElements();

      // currently using this for just credit card & address inputs
      inputsOfType = findInputsOfType(extensionContext, inputs, selects);

      inputsOfType.forEach((inputOfType) => {
        if (inputOfType.type === INPUT_TYPE_CREDIT_CARD_NUMBER) {
          haveCCInput = inputOfType.input;
          if (extensionContext && extensionContext.creditCards && extensionContext.creditCards.length) {
            showUnifiedAutofillModal(extensionContext);
          }
        } else if (
          extensionContext &&
          inputOfType.type === INPUT_TYPE_STREET_ADDRESS &&
          inputOfType.input.disabled !== true
        ) {
          haveAddressInput = inputOfType.input;
          showUnifiedAutofillModal(extensionContext, true);
        }
      });

      // Handle form submissions for addresses & credit cards
      forms.forEach((form) => {
        form.onsubmit = async () => {
          if (extensionContext && (haveAddressInput || haveCCInput || extensionContext.saveCCCardNumber)) {
            figureOutAutosaveModals(extensionContext);
          }
        };
      });

      // We're going to look for potential login targets
      // in same-origin iframes, so we gather them here!
      const sameOriginIframes = [...document.querySelectorAll("iframe")].filter((iframe) => {
        try {
          const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
          return doc?.body?.innerHTML !== null;
        } catch (err) {
          return false;
        }
      });

      // If we found some iframes, we need to
      // find some login targets in those iframes.
      const iframeLoginTargets = sameOriginIframes.map((iframe) => {
        return LoginTarget.find(iframe.contentWindow?.document, { visible: true });
      });

      // Find the most relevant login target overall (username/password/submit)
      const loginTarget: LoginTarget | null = iframeLoginTargets.reduce(
        (bestTarget, currentTarget) => {
          return (bestTarget?.score ?? 0) > (currentTarget?.score ?? 0) ? bestTarget : currentTarget;
        },
        LoginTarget.find(document, { visible: true }), // default to parent frame
      );

      const usernameInput = loginTarget?.get("username");
      const passwordInput = loginTarget?.get("password");
      const submitButton = loginTarget?.get("submit");

      // To limit the amount of scanning we do, let's make sure we're on a scan qr code page
      const isScanQRPage = onScanQRPage();

      // If we're on a scan qr code page, scan all imgs + canvases
      // We're scanning all imgs + canvases because a lot of imgs / canvs don't have any attributes
      // on them that we could identify them with. The best way we have to tell if it's a qr code is to just scan it
      if (isScanQRPage && searchForQRCodes && limitScanning === false) {
        // Scan imgs
        const imgs = document.querySelectorAll("img");
        imgs.forEach(async (img) => {
          img.crossOrigin = "Anonymous";
          try {
            const codeReader = new BrowserQRCodeReader();
            const code = await codeReader.decodeFromImageElement(img);

            if (code.getRawBytes() && extensionContext) {
              const otpURL = parseURI(code.getText());
              if (otpURL.query && otpURL.query.secret) {
                // We want to store the secret in the vault the following way:
                // - Decode the secret (it's base32 encoded when we get it)
                // - Base64 encode the raw bytes
                const decodedSecret = decodeString(otpURL.query.secret.toUpperCase());
                const b64encoded = uint8ArrayToBase64String(decodedSecret);
                if (extensionContext.siteVaultItems.length) {
                  await show2FADetectedModal(extensionContext, b64encoded);
                }
              }
            }
          } catch (error) {
            console.log(error);
          }
        });

        // Scan imgs
        const svgs = document.querySelectorAll("svg");
        svgs.forEach(async (svg) => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const xml = new XMLSerializer().serializeToString(svg);
              const canv = await Canvg.from(ctx, xml);
              canv.start();

              const codeReader = new BrowserQRCodeReader();
              const code = codeReader.decodeFromCanvas(canvas);

              if (code.getRawBytes() && extensionContext) {
                const otpURL = parseURI(code.getText());
                if (otpURL.query && otpURL.query.secret) {
                  // We want to store the secret in the vault the following way:
                  // - Decode the secret (it's base32 encoded when we get it)
                  // - Base64 encode the raw bytes
                  const decodedSecret = decodeString(otpURL.query.secret.toUpperCase());
                  const b64encoded = uint8ArrayToBase64String(decodedSecret);
                  if (extensionContext.siteVaultItems.length) {
                    await show2FADetectedModal(extensionContext, b64encoded);
                  }
                }
              }
            }
          } catch (error) {
            console.log(error);
          }
        });

        // Scan canvases
        const canvas = document.querySelectorAll("canvas");
        canvas.forEach(async (canv) => {
          try {
            const codeReader = new BrowserQRCodeReader();
            const code = codeReader.decodeFromCanvas(canv);

            // const code = searchCanvasForCode(canv);
            if (code.getRawBytes() && extensionContext) {
              const otpURL = parseURI(code.getText());
              if (otpURL.query && otpURL.query.secret) {
                // We want to store the secret in the vault the following way:
                // - Decode the secret (it's base32 encoded when we get it)
                // - Base64 encode the raw bytes
                const decodedSecret = decodeString(otpURL.query.secret.toUpperCase());
                const b64encoded = uint8ArrayToBase64String(decodedSecret);
                if (extensionContext.siteVaultItems.length) {
                  await show2FADetectedModal(extensionContext, b64encoded);
                }
              }
            }
          } catch (error) {
            console.log(error);
          }
        });
        limitScanning = true;

        // Protect this from running an absurd amount
        setTimeout(() => {
          limitScanning = false;
        }, 3000);
      }

      // Find submit buttons for save logins.  It's okay to find more than one, because when they're clicked we can check if we have a username & password, and assume we're logging in if we do.
      const submitButtons = findSubmitButtons(inputs, buttons, divs, anchors);

      const ssoButtons = findSSOBtns(inputs, buttons, divs, anchors, iframes);

      // Filter SSO buttons to see if there is a fb button
      const facebookSSOBtn = filterSSOProviderBtn(ssoButtons, SupportedSSOProviders.Facebook);
      if (facebookSSOBtn) {
        facebookSSOBtn.onclick = () => {
          if (extensionContext) {
            ssoButtonClicked(extensionContext, existingSSOChoices, SupportedSSOProviders.Facebook);
          }
        };
      }

      // Filter SSO buttons to see if there is a google button
      const googleSSOBtn = filterSSOProviderBtn(ssoButtons, SupportedSSOProviders.Google);
      if (googleSSOBtn) {
        googleSSOBtn.onclick = () => {
          if (extensionContext) {
            ssoButtonClicked(extensionContext, existingSSOChoices, SupportedSSOProviders.Google);
          }
        };
      }

      // Filter SSO buttons to see if there is a google button
      const appleSSOBtn = filterSSOProviderBtn(ssoButtons, SupportedSSOProviders.Apple);
      if (appleSSOBtn) {
        appleSSOBtn.onclick = () => {
          if (extensionContext) {
            ssoButtonClicked(extensionContext, existingSSOChoices, SupportedSSOProviders.Apple);
          }
        };
      }

      // Magic login SSO Clicked
      if (extensionContext && extensionContext.magicLoginInitiated && extensionContext.magicLoginSSOChoice) {
        switch (extensionContext.magicLoginSSOChoice) {
          case SupportedSSOProviders.Facebook:
            if (facebookSSOBtn) {
              facebookSSOBtn.click();
              // Magic login likes to pop back up if the button click takes a sec, let's keep it closed
              keepMagicLoginClosed = true;
              resetMagicLoginState(extensionContext);
            }
            break;
          case SupportedSSOProviders.Google:
            if (googleSSOBtn) {
              googleSSOBtn.click();
              // Magic login likes to pop back up if the button click takes a sec, let's keep it closed
              keepMagicLoginClosed = true;
              resetMagicLoginState(extensionContext);
            }
            break;
          case SupportedSSOProviders.Apple:
            if (appleSSOBtn) {
              appleSSOBtn.click();
              // Magic login likes to pop back up if the button click takes a sec, let's keep it closed
              keepMagicLoginClosed = true;
              resetMagicLoginState(extensionContext);
            }
            break;
          default:
            break;
        }
      }

      // Find forms for save logins
      const loginForms = findLoginForms(forms);

      // Set onsubmit of forms and onclick of submit buttons to kick off save logins and missing info save login flow
      if (extensionContext.magicLoginInitiated === false && extensionContext.saveLoginShowing === false) {
        if (usernameInput && passwordInput && usernameInput.value) {
          loginForms.forEach((loginForm) => {
            loginForm.onsubmit = async () => {
              if (onSignupPage == false) {
                await loginSubmitted(extensionContext, usernameInput, passwordInput);
              }
            };
          });

          submitButtons.forEach((submitButton) => {
            submitButton.onclick = async () => {
              if (onSignupPage == false) {
                await loginSubmitted(extensionContext, usernameInput, passwordInput);
              }
            };
          });

          // When someone hits enter on a password input, show the modal
          passwordInput.onkeydown = async (e: KeyboardEvent) => {
            const keyCode = e.code || e.key;
            if (keyCode == "Enter") {
              if (onSignupPage == false) {
                await loginSubmitted(extensionContext, usernameInput, passwordInput);
              }
            }
          };

          // If we are missing a username, Show missing info UX
        } else if (passwordInput && passwordInput.value) {
          extensionContext.saveLoginPassword = passwordInput.value;
          loginForms.forEach((loginForm) => {
            loginForm.onsubmit = () => {
              if (extensionContext) {
                extensionContext.saveLoginPassword = passwordInput.value;
                partialLoginSubmitted(extensionContext);
              }
            };
          });

          // Missing info onclick for submit buttons
          submitButtons.forEach((submitButton) => {
            submitButton.onclick = () => {
              if (extensionContext) {
                extensionContext.saveLoginPassword = passwordInput.value;
                partialLoginSubmitted(extensionContext);
              }
            };
          });
        }
        // extensionContext.saveCCCardNumber is required because of iframes
        if (haveAddressInput || haveCCInput || extensionContext.saveCCCardNumber) {
          submitButtons.forEach((btn) => {
            btn.onclick = () => {
              if (extensionContext) {
                figureOutAutosaveModals(extensionContext);
              }
            };
          });
        }
      }

      // Are we on a login page?
      const onLoginPage = isLoginPage(usernameInput, passwordInput);

      // Are we on a signup page?
      const onSignupPage = isSignupPage();

      // If we're on a signup page, suggest a strong password
      if (onSignupPage && passwordInput) {
        hideMagicLoginModal(extensionContext);

        const confirmPasswordInput = findConfirmPasswordInput(inputs);

        if (passwordInput === document.activeElement || suggestStrongPwOpen) {
          keepMagicLoginClosed = true;
          await v2Orchestrator?.useAction(OpenPasswordGenerator)({
            passwordInputSelector: generateCssSelector(passwordInput),
            confirmPasswordInputSelector: generateCssSelector(confirmPasswordInput),
          });
        } else {
          passwordInput.onfocus = async () => {
            // Show suggest strong pw modal
            if (extensionContext) {
              keepMagicLoginClosed = true;
              await v2Orchestrator?.useAction(OpenPasswordGenerator)({
                passwordInputSelector: generateCssSelector(passwordInput),
                confirmPasswordInputSelector: generateCssSelector(confirmPasswordInput),
              });
            }
          };
        }
      }

      // Are any sso buttons on the page.  We're only gonna show ML SSO options if one or more is present
      const ssoButtonPresent = googleSSOBtn !== null || appleSSOBtn !== null || facebookSSOBtn !== null;

      // Show magic login
      if (
        (UnoStore.getSnapshot().aiAssist.status !== "running" ||
          UnoStore.getSnapshot().aiAssist.tabID !== v2Orchestrator!.runtimeInfo.tabID) &&
        !extensionContext.magicLoginShowing &&
        !extensionContext.magicLoginInitiated &&
        !extensionContext.saveLoginShowing &&
        !extensionContext.missingInfoShowing &&
        !extensionContext.updateLoginShowing &&
        !extensionContext.saveSSOShowing &&
        extensionContext.aiAssistTopic !== "reset-password" &&
        extensionContext.siteVaultItems.length &&
        // Conditions for showing ML:
        // 1. On login page with user + pw + submit button
        // 2. On login page with user + next button
        // 3. Existing sso choices in vault & at least one sso button on the page
        ((onLoginPage && usernameInput && passwordInput && submitButtons.length) ||
          (onLoginPage && usernameInput && submitButton) ||
          // (onLoginPage || onSignupPage) &&
          (existingSSOChoices.length && ssoButtonPresent)) &&
        onSignupPage === false &&
        (!keepMagicLoginClosed || isDemoHost)
      ) {
        await v2Orchestrator?.useAction(OpenMagicLoginMenu)({
          v1Compat: { ssoButtonPresent },
        });
      }
    }

    // Give magic login 30 seconds per page to work.
    if (extensionContext && extensionContext.magicLoginInitiated) {
      magicLoginAttempts++;
      if (magicLoginAttempts > 15) {
        resetMagicLoginState(extensionContext);
      }
    }

    if (skipIterations > 0) {
      skipIterations--;
    }
  }
};

function getElements(): [
  HTMLInputElement[],
  HTMLFormElement[],
  HTMLButtonElement[],
  HTMLDivElement[],
  HTMLAnchorElement[],
  HTMLIFrameElement[],
  HTMLSelectElement[],
] {
  const inputs: HTMLInputElement[] = Array.prototype.slice.call(document.querySelectorAll("input"));
  const forms: HTMLFormElement[] = Array.prototype.slice.call(document.querySelectorAll("form"));
  const buttons: HTMLButtonElement[] = Array.prototype.slice.call(document.querySelectorAll("button"));
  const divs: HTMLDivElement[] = Array.prototype.slice.call(document.querySelectorAll("div"));

  const anchors: HTMLAnchorElement[] = Array.prototype.slice.call(document.querySelectorAll("a"));

  const iframes: HTMLIFrameElement[] = Array.prototype.slice.call(document.querySelectorAll("iframe"));

  const selects: HTMLSelectElement[] = Array.prototype.slice.call(document.querySelectorAll("select"));

  return [inputs, forms, buttons, divs, anchors, iframes, selects];
}

function findLoginForms(forms: HTMLFormElement[]): HTMLFormElement[] {
  const loginForms: HTMLFormElement[] = [];
  forms.forEach((form) => {
    const html = form.innerHTML;

    // Check for username input
    if (
      html.includes("login") ||
      html.includes("username") ||
      html.includes("email") ||
      html.includes("Username") ||
      html.includes("password")
    ) {
      loginForms.push(form);
    }
  });
  return loginForms;
}

// Check if we should fire save login, and fire it if so
export async function loginSubmitted(
  extensionContext: ExtensionContext | null,
  usernameInput: HTMLInputElement,
  passwordInput: HTMLInputElement,
) {
  if (extensionContext) {
    const shouldSaveLogin = saveLoginCriteriaMet(usernameInput, passwordInput, extensionContext);
    const shouldUpdateLogin = updateLoginCriteriaMet(usernameInput, passwordInput, extensionContext);

    if (shouldSaveLogin) {
      hideSuggestStrongPWModal();
      hideMagicLoginModal(extensionContext);
      extensionContext.saveLoginUsername = usernameInput.value;
      extensionContext.saveLoginPassword = passwordInput.value;
      extensionContext.saveLoginHostname = window.location.hostname;

      extensionContext.saveLoginShowing = true;
      startModalTimer(15_000, extensionContext);
      await showSaveLoginModal(extensionContext);
      updateExtensionContext(extensionContext);
    } else if (shouldUpdateLogin && extensionContext.updateLoginShowing === false) {
      hideSuggestStrongPWModal();
      hideMagicLoginModal(extensionContext);
      extensionContext.saveLoginUsername = usernameInput.value;
      extensionContext.saveLoginPassword = passwordInput.value;
      extensionContext.saveLoginHostname = window.location.hostname;

      extensionContext.updateLoginShowing = true;
      updateExtensionContext(extensionContext);
      await showUpdateLoginModal(extensionContext);
    }
  }
}

export async function partialLoginSubmitted(extensionContext: ExtensionContext | null) {
  if (
    extensionContext &&
    extensionContext.missingInfoShowing === false &&
    (await UnoStore.getState()).aiAssist.status !== "running"
  ) {
    extensionContext.missingInfoShowing = true;
    extensionContext.saveLoginHostname = window.location.hostname;
    hideMagicLoginModal(extensionContext);
    hideSuggestStrongPWModal();
    await showMissingInfoModal(extensionContext);
    updateExtensionContext(extensionContext);
  }
}

function findConfirmPasswordInput(inputs: HTMLInputElement[]): HTMLInputElement | null {
  // let passwordInput: HTMLInputElement | null = null;

  // See if there is one form that contains the inputs
  const filteredInputs = inputs.filter((input) => {
    return meetsConfirmPWRules(input);
  });

  if (filteredInputs.length === 1) {
    return filteredInputs[0];
  }

  return null;
}

const hasSignUpVerbiage = (stringToCheck: string): boolean => {
  if (
    stringToCheck.includes("by signing up, you agree to") ||
    stringToCheck.includes("by signing up, I agree to") ||
    stringToCheck.includes("by creating an account, you agree to") ||
    stringToCheck.includes("by creating an account, you agree with") ||
    stringToCheck.includes("by registering, you agree to") ||
    stringToCheck.includes("by clicking “continue” you agree to") ||
    stringToCheck.includes("create an account, you agree to") ||
    stringToCheck.includes("by clicking agree & join, you agree to") ||
    stringToCheck.includes("by clicking this box, you agree to") ||
    stringToCheck.includes("by creating an account, you agree") ||
    stringToCheck.includes("by creating an account, you are agreeing to")
  ) {
    return true;
  }
  return false;
};

function findSubmitButtons(
  inputs: HTMLInputElement[],
  buttons: HTMLButtonElement[],
  divs: HTMLDivElement[],
  anchors: HTMLAnchorElement[],
): HTMLElement[] {
  const submitButtons: HTMLElement[] = [];

  // TODO; A simplification that can be made to the element finding stuff:
  // toLowerCase().strip().replace(/\s/g, "")
  // remove all white space
  // avoids having to search login and log in...

  // Check buttons
  buttons.forEach((button) => {
    const html = button.outerHTML.toLowerCase().trim();
    // Check for username input
    if (
      (html.includes("submit") ||
        html.includes("next") ||
        html.includes("signinbutton") ||
        html.includes("login") ||
        html.includes("log in") ||
        html.includes("signin") ||
        button.innerText.toLowerCase().trim() === "continue" ||
        button.innerText.toLowerCase().trim() === "log in" ||
        button.innerText.toLowerCase().trim() === "log on" ||
        button.innerText.toLowerCase().trim() === "login" ||
        button.innerText.toLowerCase().trim() === "signin" ||
        button.innerText.toLowerCase().trim() === "sign in" ||
        button.innerText.toLowerCase().trim() === "confirm") &&
      !html.includes("subscribe")
    ) {
      submitButtons.push(button);
    }
  });

  // Search inputs
  inputs.forEach((input) => {
    // Sometimes submit buttons are inputs cough cough github
    if (input.type === "submit" && input.name !== "password") {
      submitButtons.push(input);
    }
  });

  // Search divs
  divs.forEach((div) => {
    if (div.getAttribute("role") === "button" && div.ariaLabel?.toLowerCase().trim() !== "back") {
      submitButtons.push(div);
    }
  });

  // Search anchors
  anchors.forEach((a) => {
    if (a.innerText) {
      const innerText = a.innerText.toLowerCase().trim();
      if (
        (a.id === "login-button" && a.getAttribute("role") === "button") ||
        innerText === "login" ||
        innerText === "log in" ||
        innerText === "signin" ||
        innerText === "sign in"
      ) {
        submitButtons.push(a);
      }
    }
  });

  return submitButtons;
}

async function createModalFromTemplate(
  template: string,
  hostID: string,
  width = "260px",
  height = "auto",
): Promise<{
  shadow: ShadowRoot;
  host: HTMLDivElement;
}> {
  const modalContainer = document.createElement("uno-container");
  modalContainer.id = "uno-modal";
  modalContainer.tabIndex = 0;
  modalContainer.style.setProperty("all", "initial");
  modalContainer.style.all = "initial";
  modalContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";
  modalContainer.style.width = `${width}`;
  modalContainer.style.height = `${height}`;
  modalContainer.style.position = "fixed";
  modalContainer.style.zIndex = "1000000";
  modalContainer.style.display = "none";
  modalContainer.style.margin = "24px 0 0 24px";

  // The modals need to be positioned differently on the demo site
  if (isDemoHost) {
    modalContainer.style.left = "40px";
    modalContainer.style.top = "134px";
    modalContainer.style.margin = "unset";

    setTimeout(() => {
      showDemoSpotlight();
    }, 100);
  }

  const resp = await fetch(chrome.runtime.getURL(template));
  const htmlText = await resp.text();
  modalContainer.innerHTML = htmlText;

  const mcc = modalContainer.cloneNode(true);

  const host = document.createElement("div");
  host.id = hostID;
  document.body.prepend(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Add tailwind
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.type = "text/css";
  style.id = "uno-modal-styles";
  style.href = chrome.runtime.getURL("globals.css");
  const sc = style.cloneNode(true);

  shadow.appendChild(sc);
  shadow.appendChild(mcc);

  return { shadow, host };
}

async function showSaveLoginModal(extensionContext: ExtensionContext): Promise<void> {
  if ((extensionContext.saveLoginUsername || extensionContext.saveSSOShowing) && noOtherModalsShowing()) {
    const { shadow, host } = await createModalFromTemplate("modals/save_login.html", "uno-save-container");

    // Set the time text
    const timer = shadow.getElementById("modal-timer");
    if (timer) {
      timer.style.width = `${
        ((15000 -
          (extensionContext !== null && extensionContext.modalTickTime !== null
            ? extensionContext.modalTickTime
            : 15000)) /
          15000) *
        100
      }`;
    }

    const timerText = shadow.getElementById("timer-text");
    if (timerText && extensionContext.saveSSOShowing) {
      timerText.innerText = "Saving SSO Choice";
    }

    const confirmSaveLoginBtn = shadow.getElementById("confirm-save-login");
    if (confirmSaveLoginBtn) {
      confirmSaveLoginBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
        expireModalTimer(extensionContext);
      };
    }

    createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginModalDisplayed);

    const cancelSaveLoginBtn = shadow.getElementById("cancel-save-login");
    if (cancelSaveLoginBtn) {
      cancelSaveLoginBtn.onclick = () => {
        createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginCancelled);
        removeModalAndListener(host, shadow, keyupHandler);

        extensionContext.saveSSOChoice = null;

        expireModalTimer(extensionContext);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;

        updateExtensionContext(extensionContext);
      };
    }

    const feedbackBtn = shadow.getElementById("feedback-button");

    if (feedbackBtn) {
      feedbackBtn.onclick = () => {
        showFeedbackModal(extensionContext);
        expireModalTimer(extensionContext);
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    // TODO: Remove this, I don't think there even is a close button on the save login modal
    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);

        extensionContext.saveSSOChoice = null;

        expireModalTimer(extensionContext);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;

        updateExtensionContext(extensionContext);
      };
    }
    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);

        extensionContext.saveSSOChoice = null;

        expireModalTimer(extensionContext);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;

        updateExtensionContext(extensionContext);

        document.removeEventListener("keyup", keyupHandler);
        createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginCancelled);
      } else if (e.key === "Enter") {
        removeModalAndListener(host, shadow, keyupHandler);
        expireModalTimer(extensionContext);
      }
    };
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 500);
    waitForModalStylesToLoad(shadow, async () => {
      const referenceElement = shadow.getElementById("confirm-save-login");
      if (referenceElement) {
        await v2Orchestrator?.useAction(ViewSaveLoginHint)({
          root: generateCssSelector(shadow.host),
          referenceElement: generateCssSelector(referenceElement),
          offset: 40,
          placement: "right-start",
        });
      }
    });
  }
}

async function showEmailModal(extensionContext: ExtensionContext): Promise<void> {
  const { shadow, host } = await createModalFromTemplate("modals/email_modal.html", "uno-gmail-container");

  let currentEmailIndex = 0;
  let currentEmailID: null | number = null;

  const keyupHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      removeModalAndListener(host, shadow, keyupHandler);
      document.removeEventListener("keydown", kbShortcutListener);
    }
  };
  document.addEventListener("keyup", keyupHandler);

  extensionContext.magicLoginShowing = false;
  extensionContext.magicLoginInitiated = false;

  if (extensionContext.gmailToken != null) {
    const getMessagesResp = await getMessages(extensionContext.gmailToken, currentEmailIndex);

    if (getMessagesResp.errorCode) {
      extensionContext.googleAuthError = true;
      updateExtensionContext(extensionContext);
      removeModalAndListener(host, shadow, keyupHandler);
      return;
    }

    currentEmailID = getMessagesResp.id;
    getBody(getMessagesResp.payload);

    const holder = shadow.getElementById("iframe-holder");

    const iframe = document.createElement("iframe");
    iframe.id = "uno-email-iframe";
    iframe.srcdoc = getBody(getMessagesResp.payload);
    iframe.style.height = "317px";
    iframe.style.width = "244px";
    iframe.style.transformOrigin = "top center";
    iframe.style.border = "1px solid #E7E8EA";
    iframe.style.borderRadius = "8px";
    iframe.style.background = "#E7E8EA";

    // Create style for hidden scrollbar that we'll inject in the iframe html
    const css = `.scrolling-section {
      background-color: #eee;
      overflow: scroll;
    }

    .scrolling-section::-webkit-scrollbar {
        display: none !important;
    }

    .scrolling-section {
      -ms-overflow-style: none !important;
      scrollbar-width: none !important;
    }`;
    const style = document.createElement("style");
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));

    // We have to wait for the document to load to do some stuff
    iframe.addEventListener("load", () => {
      if (iframe && iframe.contentDocument) {
        iframe.contentDocument.documentElement.style.overflow = "scroll";
        iframe.contentDocument.head.appendChild(style);

        // Open links in new tab
        const links = iframe.contentDocument.getElementsByTagName("a");
        for (const link of Array.from(links)) {
          link.target = "_blank";
        }

        iframe.contentDocument.documentElement.classList.add("scrolling-section");
        try {
          // @ts-expect-error: zoom not supported on safari
          iframe.contentDocument.documentElement.style.zoom = 0.8;
        } catch (error) {
          console.log("Got an error setting zoom", error);
        }

        // After setting the styles, make it visible
        host.style.display = "flex";
        const m = shadow.getElementById("uno-modal");
        if (m) {
          m.style.display = "flex";
        }
      }
    });

    holder?.appendChild(iframe);
  }

  const refreshBtn = shadow.getElementById("refresh-button");
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      // Enable prev button if we're past first email
      currentEmailIndex = 0;

      shadow.getElementById("previous-email-button-disabled")?.classList.remove("hidden");
      shadow.getElementById("previous-email-button-enabled")?.classList.add("hidden");

      if (extensionContext.gmailToken != null) {
        const getMessagesResp = await getMessages(extensionContext.gmailToken, currentEmailIndex);

        if (getMessagesResp.errorCode) {
          extensionContext.googleAuthError = true;
          updateExtensionContext(extensionContext);
          removeModalAndListener(host, shadow, keyupHandler);
          return;
        }
        currentEmailID = getMessagesResp.id;

        const emailIframe = shadow.getElementById("uno-email-iframe") as HTMLIFrameElement | null;
        if (emailIframe) {
          emailIframe.srcdoc = getBody(getMessagesResp.payload);
        }
      }
    };
  }

  const nextBtn = shadow.getElementById("next-email-button-enabled");
  if (nextBtn) {
    nextBtn.onclick = async () => {
      currentEmailIndex++;

      // Enable prev button if we're past first email
      if (currentEmailIndex > 0) {
        shadow.getElementById("previous-email-button-disabled")?.classList.add("hidden");
        shadow.getElementById("previous-email-button-enabled")?.classList.remove("hidden");
      }

      if (extensionContext.gmailToken != null) {
        const getMessagesResp = await getMessages(extensionContext.gmailToken, currentEmailIndex);

        if (getMessagesResp.errorCode) {
          extensionContext.googleAuthError = true;
          updateExtensionContext(extensionContext);

          removeModalAndListener(host, shadow, keyupHandler);
          return;
        }
        currentEmailID = getMessagesResp.id;

        const emailIframe = shadow.getElementById("uno-email-iframe") as HTMLIFrameElement | null;
        if (emailIframe) {
          emailIframe.srcdoc = getBody(getMessagesResp.payload);
        }
      }
    };
  }

  const prevButton = shadow.getElementById("previous-email-button-enabled");
  if (prevButton) {
    prevButton.onclick = async () => {
      if (currentEmailIndex > 0) {
        currentEmailIndex--;

        // Disable prev button if we're at first emailf
        if (currentEmailIndex === 0) {
          shadow.getElementById("previous-email-button-disabled")?.classList.remove("hidden");
          shadow.getElementById("previous-email-button-enabled")?.classList.add("hidden");
        }

        if (extensionContext.gmailToken != null) {
          const getMessagesResp = await getMessages(extensionContext.gmailToken, currentEmailIndex);

          if (getMessagesResp.errorCode) {
            extensionContext.googleAuthError = true;
            updateExtensionContext(extensionContext);
            removeModalAndListener(host, shadow, keyupHandler);
            return;
          }
          currentEmailID = getMessagesResp.id;
          const emailIframe = shadow.getElementById("uno-email-iframe") as HTMLIFrameElement | null;
          if (emailIframe) {
            emailIframe.srcdoc = getBody(getMessagesResp.payload);
          }
        }
      }
    };
  }

  const archiveChromeBtn = shadow.getElementById("archive-email-button");
  if (archiveChromeBtn) {
    archiveChromeBtn.onclick = async () => {
      if (currentEmailIndex >= 0 && extensionContext.gmailToken != null && currentEmailID) {
        await archiveEmail(extensionContext.gmailToken, currentEmailID);
        removeModalAndListener(host, shadow, keyupHandler);
        document.removeEventListener("keydown", kbShortcutListener);
      }
    };
  }

  const archiveSafariBtn = shadow.getElementById("archive-email-button-safari");
  if (archiveSafariBtn) {
    archiveSafariBtn.onclick = async () => {
      if (currentEmailIndex >= 0 && extensionContext.gmailToken != null && currentEmailID) {
        await archiveEmail(extensionContext.gmailToken, currentEmailID);
        removeModalAndListener(host, shadow, keyupHandler);
        document.removeEventListener("keydown", kbShortcutListener);
      }
    };
  }

  // Safari uses shift + cmd for kb shortcuts
  if (safari && archiveChromeBtn && archiveSafariBtn) {
    if (archiveChromeBtn && archiveSafariBtn) {
      archiveChromeBtn.classList.add("hidden");
      archiveSafariBtn.classList.remove("hidden");
    }
  }

  // Setup keyboard shortcut
  let shortcutFired = false;
  const kbShortcutListener = async (e: KeyboardEvent) => {
    if (
      // Chrome uses cmd + 1
      ((e.metaKey && e.code === `Digit1` && shortcutFired === false && safari === false) ||
        // Safari uses cmd + shift + 1 because safari doesn't let you map to cmd + 1
        (e.metaKey && e.shiftKey && e.code === `Digit1` && shortcutFired === false && safari)) &&
      extensionContext &&
      extensionContext.gmailToken &&
      currentEmailID
    ) {
      shortcutFired = true;
      e.preventDefault();

      await archiveEmail(extensionContext.gmailToken, currentEmailID);

      removeModalAndListener(host, shadow, keyupHandler);
      document.removeEventListener("keydown", kbShortcutListener);
      setTimeout(() => {
        shortcutFired = false;
      }, 1000);
    }
  };

  document.addEventListener("keydown", kbShortcutListener);

  const closeModalBtn = shadow.getElementById("close-overlay");
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      document.removeEventListener("keydown", kbShortcutListener);
      removeModalAndListener(host, shadow, keyupHandler);
    };
  }
}

export async function showFeedbackModal(extensionContext: ExtensionContext, customFeedback?: string): Promise<void> {
  const { shadow, host } = await createModalFromTemplate("modals/feedback_modal.html", "uno-feedback-container");

  const keyupHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      removeModalAndListener(host, shadow, keyupHandler);
      document.removeEventListener("keyup", keyupHandler);
    }
  };
  document.addEventListener("keyup", keyupHandler);

  extensionContext.magicLoginShowing = false;
  extensionContext.magicLoginInitiated = false;

  const detailsInput = shadow.getElementById("details-input") as HTMLTextAreaElement;
  const stopPropagation = (e: Event) => {
    e.stopPropagation();
  };
  const keyEventsToStopPropagating = [
    "keydown",
    "keyup",
    "keypress",
    "keydowncapture",
    "keyupcapture",
    "keypresscapture",
  ];
  if (detailsInput != null) {
    // Some websites (looking at you GitHub) listen for key events globally to
    // enable hot-keys/shortcuts. This interferes with our freeform feedback
    // input.
    //
    // TODO: find some way to stop these events propagating globally from any of
    // our shadow roots.
    //
    // @see: https://stackoverflow.com/questions/62466071/how-to-stop-propagation-in-shadow-dom
    keyEventsToStopPropagating.forEach((keyEvtType) => {
      detailsInput.addEventListener(keyEvtType, stopPropagation);
    });
  }

  const feedbackBtnsContainer = shadow.getElementById("feedback-buttons-container");
  const additionalInfoSection = shadow.getElementById("additional-details");

  if (feedbackBtnsContainer && additionalInfoSection && detailsInput) {
    if (customFeedback) {
      feedbackBtnsContainer.style.display = "none";
      additionalInfoSection.style.display = "flex";
      detailsInput.focus();
    } else {
      feedbackBtnsContainer.childNodes.forEach((child) => {
        const childElement = child as HTMLElement;
        if (childElement.id && childElement.id.includes("send-feedback")) {
          childElement.onclick = () => {
            childElement.setAttribute("selected-item", "true");
            feedbackBtnsContainer.style.display = "none";
            additionalInfoSection.style.display = "flex";
            detailsInput.focus();
          };
        }
      });
    }
  }

  const shareFeedbackBtn = shadow.getElementById("share-feedback");
  if (shareFeedbackBtn) {
    shareFeedbackBtn.onclick = () => {
      // 1. Get the feedback that was selected
      if (feedbackBtnsContainer) {
        const emitFeedbackEvents = async (feedbackSelected: string) => {
          // 2. Get any feedback that was in the input
          if (detailsInput) {
            let message = "";
            const inputData = detailsInput.value.trim();
            if (inputData.length > 0) {
              message = dedent`
                \n## Details \n> ${inputData.split("\n").join("\n> ")}
              `;
            }

            const user_details = dedent`
              **User Email:** \`${extensionContext.email}\`${message}
            `;

            // 3. Check for permission to send email + website url
            let optionalWebsite = "";
            const shareMoreInfoCheckbox = shadow.getElementById("share-more-info-checkbox") as HTMLInputElement;
            if (shareMoreInfoCheckbox && shareMoreInfoCheckbox.checked) {
              const sanitized_location = location.toString().replace(location.search, "");
              optionalWebsite = dedent`
                \n**Website:** \`${sanitized_location}\`
              `;
            }

            const problem = dedent`
              # ${feedbackSelected.trim().toUpperCase()}${optionalWebsite}
            `;

            // 4. Analytics event
            // TODO: Have an event per feedback type & incorporate website + email
            createAnalyticsEvent(LegacyAnalyticsEvent.FeedbackSubmitted);

            // 4.5 Context Info
            // @ts-expect-error: constant is overwritten by build script.
            // eslint-disable-next-line
            const env_name = ENV_NAME;
            const info = UAParser(navigator.userAgent);
            const context_info = dedent`
              ## Context
              **Extension Version:** ${chrome.runtime.getManifest().version}
              **Build Flavor:** ${env_name.charAt(0).toUpperCase() + env_name.slice(1)}
              **Device:** ${info.device.vendor} ${info.device.model}
              **Browser:** ${info.browser.name} (${info.browser.version})
              **OS:** ${info.os.name} (${info.os.version})
            `;

            // 5. Discord message
            const discordFeedbackChannel =
              "https://discord.com/api/webhooks/1016392315121717321/2yMdjTEwmlxvt3mCuIDP_501hAZkMN8SX9tpYWd2mw8Oid0POCLNU1mInwTD4YselrDl";
            await fetch(discordFeedbackChannel, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                content: dedent`
                  ${problem}
                  ${user_details}
                  ${context_info}
                `,
              }),
            });

            keyEventsToStopPropagating.forEach((keyEvtType) => {
              detailsInput.removeEventListener(keyEvtType, stopPropagation);
            });

            removeModalAndListener(host, shadow, keyupHandler);
          }
        };

        if (customFeedback) {
          emitFeedbackEvents(customFeedback);
        } else {
          feedbackBtnsContainer.childNodes.forEach(async (child) => {
            const childElement = child as HTMLElement;
            if (childElement.nodeName !== "#text" && childElement.getAttribute("selected-item")) {
              emitFeedbackEvents(childElement.innerText);
            }
          });
        }
      }
    };
  }

  const closeModalBtn = shadow.getElementById("close-overlay");
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      keyEventsToStopPropagating.forEach((keyEvtType) => {
        detailsInput.removeEventListener(keyEvtType, stopPropagation);
      });

      removeModalAndListener(host, shadow, keyupHandler);
    };
  }

  waitForModalStylesToLoad(shadow);
}

async function showUpdateLoginModal(extensionContext: ExtensionContext): Promise<void> {
  if (noOtherModalsShowing()) {
    const { shadow, host } = await createModalFromTemplate("modals/update_login.html", "uno-update-login-container");

    // After we modify what we need to, show modal
    const modal = shadow.getElementById("uno-modal");
    if (modal) {
      modal.style.visibility = "visible";
    }

    // Update user / password
    const usernameInput = shadow.getElementById("update-login-username") as HTMLInputElement;
    const passwordInput = shadow.getElementById("update-login-password") as HTMLInputElement;

    if (usernameInput && passwordInput && extensionContext.saveLoginUsername && extensionContext.saveLoginPassword) {
      usernameInput.value = extensionContext.saveLoginUsername;
      passwordInput.value = extensionContext.saveLoginPassword;
    }

    const confirmSaveLoginBtn = shadow.getElementById("update-login-save");
    if (confirmSaveLoginBtn) {
      confirmSaveLoginBtn.onclick = () => {
        updateVaultForSaveLogin(extensionContext);
        removeModalAndListener(host, shadow, keyupHandler);
        extensionContext.updateLoginShowing = false;
        updateExtensionContext(extensionContext);
      };
    }

    const cancelSaveLoginBtn = shadow.getElementById("update-login-cancel");
    if (cancelSaveLoginBtn) {
      cancelSaveLoginBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);

        expireModalTimer(extensionContext);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;
        extensionContext.updateLoginShowing = false;
        updateExtensionContext(extensionContext);
      };
    }

    const feedbackBtn = shadow.getElementById("feedback-button");

    if (feedbackBtn) {
      feedbackBtn.onclick = () => {
        showFeedbackModal(extensionContext);
        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;
        extensionContext.updateLoginShowing = false;
        updateExtensionContext(extensionContext);
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;
        extensionContext.updateLoginShowing = false;
        updateExtensionContext(extensionContext);
      };
    }
    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;
        extensionContext.updateLoginShowing = false;
        updateExtensionContext(extensionContext);

        document.removeEventListener("keyup", keyupHandler);
      } else if (e.key === "Enter") {
        removeModalAndListener(host, shadow, keyupHandler);
        extensionContext.updateLoginShowing = false;
        updateVaultForSaveLogin(extensionContext);
      }
    };
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 500);
    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginUpdateExistingAccount);
  }
}

async function showMissingInfoModal(extensionContext: ExtensionContext): Promise<void> {
  if (noOtherModalsShowing() && saveLoginSaved === false) {
    const { shadow, host } = await createModalFromTemplate(
      "modals/save_login_missing_info.html",
      "missing-info-container",
    );

    const missingInfoDomain = shadow.getElementById("missing-info-domain");
    if (missingInfoDomain && extensionContext.saveLoginHostname) {
      missingInfoDomain.innerText = extensionContext.saveLoginHostname;
    }

    const missingInfoPassword = shadow.getElementById("missing-info-password") as HTMLInputElement | null;
    if (missingInfoPassword) {
      missingInfoPassword.value = `${extensionContext.saveLoginPassword}`;
    }

    // After we modify what we need to, show modal
    const modal = shadow.getElementById("missing-info-container");
    if (modal) {
      modal.style.visibility = "visible";
    }

    const saveMissingInfoBtn = shadow.getElementById("save-missing-info");
    if (saveMissingInfoBtn) {
      saveMissingInfoBtn.onclick = async () => {
        const missingEmailInput = shadow.getElementById("missing-username") as HTMLInputElement;
        if (missingEmailInput) {
          removeModalAndListener(host, shadow, keyupHandler);
          extensionContext.missingInfoShowing = false;

          extensionContext.saveLoginUsername = missingEmailInput.value;
          updateExtensionContext(extensionContext);

          const existingVaultItem = findVaultForUsername(
            extensionContext.siteVaultItems,
            extensionContext.saveLoginUsername,
          );
          if (existingVaultItem) {
            // TODO: Solve this.  We shouldn't need this but do atm because of the modal animations delay
            setTimeout(async () => {
              await showDuplicateFoundModal(extensionContext);
            }, 300);
          } else {
            updateVaultForSaveLogin(extensionContext);
          }
        }
      };
    }

    const cancelMissingInfoBtn = shadow.getElementById("cancel-missing-info");
    if (cancelMissingInfoBtn) {
      cancelMissingInfoBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
        extensionContext.missingInfoShowing = false;

        expireModalTimer(extensionContext);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;

        updateExtensionContext(extensionContext);
      };
    }

    const keyupHandler = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);
        extensionContext.missingInfoShowing = false;

        expireModalTimer(extensionContext);

        extensionContext.saveLoginUsername = null;
        extensionContext.saveLoginPassword = null;

        updateExtensionContext(extensionContext);

        document.removeEventListener("keyup", keyupHandler);
      } else if (e.key === "Enter") {
        if (host) {
          removeModalAndListener(host, shadow, keyupHandler);

          const missingEmailInput = shadow.getElementById("missing-username") as HTMLInputElement;
          if (missingEmailInput) {
            document.getElementById("uno-missing-info-modal")?.remove();
            extensionContext.missingInfoShowing = false;
            extensionContext.saveLoginUsername = missingEmailInput.value;
            updateExtensionContext(extensionContext);

            const existingVaultItem = findVaultForUsername(extensionContext.siteVaultItems, missingEmailInput.value);
            if (existingVaultItem) {
              setTimeout(async () => {
                await showDuplicateFoundModal(extensionContext);
              }, 300);
            } else {
              updateVaultForSaveLogin(extensionContext);
            }
          }
        }
      }
    };
    // If a user hits enter when entering a password, the enter event triggers.  Delay registering the handler for a bit
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 2000);
    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginMissingInfo);
  }
}

async function showDuplicateFoundModal(extensionContext: ExtensionContext): Promise<void> {
  if (noOtherModalsShowing()) {
    const { shadow, host } = await createModalFromTemplate(
      "modals/save_login_missing_info_duplicate.html",
      "uno-duplicate-found-modal",
    );

    const confirmSaveLoginBtn = shadow.getElementById("save-duplicate");
    if (confirmSaveLoginBtn) {
      confirmSaveLoginBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
        updateVaultForSaveLogin(extensionContext);
      };
    }

    const cancelSaveLoginBtn = shadow.getElementById("cancel-save-duplicate");
    if (cancelSaveLoginBtn) {
      cancelSaveLoginBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
        resetSaveLoginState(extensionContext);
      };
    }

    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);
        resetSaveLoginState(extensionContext);
      } else if (e.key === "Enter") {
        removeModalAndListener(host, shadow, keyupHandler);
        updateVaultForSaveLogin(extensionContext);
      }
    };
    document.addEventListener("keyup", keyupHandler);
    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginDuplicateFound);
  }
}

async function show2FADetectedModal(extensionContext: ExtensionContext, seed: string): Promise<void> {
  if (noOtherModalsShowing()) {
    searchForQRCodes = false;
    // closeAllOtherModals(extensionContext);
    const { shadow, host } = await createModalFromTemplate("modals/2fa_detected.html", "uno-2fa-detected-modal");

    const detected2FADomain = shadow.getElementById("2fa-detected-domain");
    if (detected2FADomain) {
      detected2FADomain.innerText = window.location.hostname;
    }

    const accountsContainer = shadow.getElementById("accounts-container");
    if (accountsContainer) {
      // Setup regular account selections (and find sso vault item)
      for (let index = 0; index < extensionContext.siteVaultItems.length; index++) {
        const vaultItem = extensionContext.siteVaultItems[index];

        // Find the sso vault item if there is one
        if (vaultItem.ssoProvider && vaultItem.ssoProvider.length) {
          continue;
        }

        const accountBtn = document.createElement("button");
        accountBtn.id = `vault-account-${index}`;
        accountBtn.style.backgroundColor = "white";
        accountBtn.style.border = "1px solid #E7E8EA";
        accountBtn.style.borderRadius = "10000px";
        accountBtn.style.fontSize = "11px";
        accountBtn.style.fontWeight = "510";
        accountBtn.style.padding = "16px";
        accountBtn.style.marginTop = "8px";
        accountBtn.style.position = "relative";
        accountBtn.innerText = `${vaultItem.username}`;
        accountBtn.classList.add("w-full", "flex");
        if (index === extensionContext.siteVaultItems.length - 1) {
          accountBtn.style.marginBottom = "16px";
        }

        accountBtn.onclick = async () => {
          if (vaultItem.otpSeed) {
            await showOverride2FAModal(extensionContext, vaultItem, seed);
          } else {
            const saved = await save2FAToAccount(vaultItem.id, seed);
            if (saved) {
              await show2FASavedModal(extensionContext, seed);
            }
          }

          host.style.display = "none";
        };

        accountsContainer.append(accountBtn);
      }
    }

    const feedbackBtn = shadow.getElementById("feedback-button");

    if (feedbackBtn) {
      feedbackBtn.onclick = () => {
        showFeedbackModal(extensionContext);
        expireModalTimer(extensionContext);
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    // After we modify what we need to, show modal
    const modal = shadow.getElementById("2fa-detected-container");
    if (modal) {
      modal.style.visibility = "visible";
    }

    const cancel2faBtn = shadow.getElementById("cancel-2fa-detected");
    if (cancel2faBtn) {
      cancel2faBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    const keyupHandler = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);
      }
    };
    // If a user hits enter when entering a password, the enter event triggers.  Delay registering the handler for a bit
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 2000);
    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.QRCodeDetectedAutoDisplayed);
  }
}

async function show2FASavedModal(extensionContext: ExtensionContext, seed: string): Promise<void> {
  if (noOtherModalsShowing()) {
    const { shadow, host } = await createModalFromTemplate("modals/2fa_saved.html", "uno-2fa-saved-host");

    const code = await v2Orchestrator?.useAction(GenerateOneTimeCodeFromSeed)({ seed });

    const copyBtn = shadow.getElementById("copy-code-btn");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const codeDiv = shadow.getElementById("uno-code");
        if (codeDiv) {
          copyBtn?.classList.add("hidden");
          copiedBtn?.classList.remove("hidden");
          await navigator.clipboard.writeText(codeDiv.innerText);

          hideDemoSpotlight();

          if (isDemoHost) {
            createAnalyticsEvent(LegacyAnalyticsEvent.DemoVerificationCodeCopied);
          }
        }
      };
    }

    const copiedBtn = shadow.getElementById("code-copied-btn");

    const nextCodeInterval = setInterval(async () => {
      const newCode = await v2Orchestrator?.useAction(GenerateOneTimeCodeFromSeed)({ seed });
      const codeDiv = shadow.getElementById("uno-code");
      if (newCode && codeDiv && `${codeDiv.innerText}` !== `${newCode}`) {
        copyBtn?.classList.remove("hidden");
        copiedBtn?.classList.add("hidden");
        codeDiv.innerText = newCode;
      }
    }, 5_000);

    // Set code and copy to clipboard
    const codeDiv = shadow.getElementById("uno-code");
    if (code && codeDiv) {
      codeDiv.innerText = code;
      // If the browser is not safari, don't auto copy.  Safari fails if it doesn't work
      // TODO: just make this a try catch :facepalm:
      if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) === false) {
        await navigator.clipboard.writeText(code);
      }
    }

    const feedbackBtn = shadow.getElementById("feedback-button");

    if (feedbackBtn) {
      feedbackBtn.onclick = () => {
        showFeedbackModal(extensionContext);
        expireModalTimer(extensionContext);
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    // After we modify what we need to, show modal
    const modal = shadow.getElementById("2fa-saved-container");
    if (modal) {
      modal.style.visibility = "visible";
    }

    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        keepMagicLoginClosed = false;
        clearInterval(nextCodeInterval);
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }
    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearInterval(nextCodeInterval);
        removeModalAndListener(host, shadow, keyupHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 500);
    waitForModalStylesToLoad(shadow);

    if (isDemoHost) {
      const copied = shadow.getElementById("copied-text");
      if (copied) {
        copied.innerText = "Copy Your Verification Code";
      }
    }
  }
}

async function showOverride2FAModal(
  extensionContext: ExtensionContext,
  vaultItem: LoginItem,
  seed: string,
): Promise<void> {
  if (noOtherModalsShowing()) {
    const { shadow, host } = await createModalFromTemplate("modals/2fa_override.html", "uno-override-2fa-host");

    const feedbackBtn = shadow.getElementById("feedback-button");
    if (feedbackBtn) {
      feedbackBtn.onclick = () => {
        showFeedbackModal(extensionContext);
        expireModalTimer(extensionContext);
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    const overrideDomain = shadow.getElementById("2fa-override-domain");
    if (overrideDomain) {
      overrideDomain.innerText = window.location.hostname;
    }

    // After we modify what we need to, show modal
    const modal = shadow.getElementById("override-2fa-container");
    if (modal) {
      modal.style.visibility = "visible";
    }

    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    const cancelBtn = shadow.getElementById("cancel-2fa-override");
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    const saveBtn = shadow.getElementById("save-2fa-override");
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const saved = await save2FAToAccount(vaultItem.id, seed);
        if (saved) {
          await show2FASavedModal(extensionContext, seed);
        }
        removeModalAndListener(host, shadow, keyupHandler);
      };
    }

    const keyupHandler = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);
      } else if (e.key === "Enter") {
        const saved = await save2FAToAccount(vaultItem.id, seed);
        if (saved) {
          await show2FASavedModal(extensionContext, seed);
        }
        removeModalAndListener(host, shadow, keyupHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 500);
    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.QRCodeOverrideCurrent2fa);
  }
}

async function showReconnectGmailModal() {
  if (noOtherModalsShowing() && keepReconnectClosed === false) {
    const { shadow, host } = await createModalFromTemplate("modals/reconnect_gmail.html", "reconnect-gmail-modal");

    const reconnectBtn = shadow.getElementById("uno-reconnect-google");
    if (reconnectBtn) {
      reconnectBtn.onclick = () => {
        if (extensionContext) {
          getGmailToken(true);
          keepReconnectClosed = true;
          removeModalAndListener(host, shadow, keyupHandler);
        }
      };
    }

    const closeModalAction = () => {
      keepReconnectClosed = true;
      if (extensionContext) {
        extensionContext.gmailScannerSetup = false;
      }

      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "TURN_OFF_GMAIL_SCANNER",
        }),
        function (r) {
          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "TURN_OFF_GMAIL_SCANNER_SUCCESS":
                extensionContext = message.payload;
                return;
              default:
                throw new Error(`Unexpected message kind ${message.kind}`);
            }
          } catch (e) {
            console.error("Error updating extension context", e);
          }
        },
      );
      removeModalAndListener(host, shadow, keyupHandler);
    };

    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        closeModalAction();
      };
    }

    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModalAction();
      }
    };
    document.addEventListener("keyup", keyupHandler);
    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.EmailScannerReconnect);
  }
}

async function showScanningQRCodesModal(): Promise<void> {
  if (noOtherModalsShowing()) {
    const modalContainer = document.createElement("uno-container");
    modalContainer.id = "uno-modal";
    modalContainer.style.all = "initial";
    modalContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";
    modalContainer.style.zIndex = "100000";
    modalContainer.style.display = "none";
    modalContainer.style.margin = "24px 0 0 24px";
    // modalContainer.tabIndex = 0;
    const resp = await fetch(chrome.runtime.getURL("modals/scanning_qr_codes.html"));
    const htmlText = await resp.text();
    modalContainer.innerHTML = htmlText;
    const mcC = modalContainer.cloneNode(true);
    modalContainer.replaceWith(mcC);

    const host = document.createElement("div");
    host.id = "uno-scanning-qr-container";
    host.style.position = "fixed";
    host.style.zIndex = "1000000";
    host.style.width = "100%";
    document.body.prepend(host);

    const shadow = host.attachShadow({ mode: "open" });

    // Add tailwind
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.id = "uno-modal-styles";
    style.href = chrome.runtime.getURL("globals.css");

    const sc = style.cloneNode(true);
    shadow.appendChild(sc);
    // MIKE; WOULD THIS WORK WITH MCC?
    shadow.appendChild(modalContainer);

    const keyupHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("keyup", keyupHandler);
    }, 500);
    waitForModalStylesToLoad(shadow);
  }
}

const removeQRScanningModal = () => {
  document.getElementById("uno-scanning-qr-container")?.remove();
};

async function showNoQRCodesFoundModal(): Promise<void> {
  const { shadow, host } = await createModalFromTemplate(
    "modals/scanning_qr_none_found.html",
    "uno-qr-scanning-none-host",
    "216px",
    "72px",
  );
  waitForModalStylesToLoad(shadow);
  setTimeout(() => {
    if (shadow) {
      const controller = shadow.getElementById("uno-modal-controller");
      if (controller) {
        controller.classList.remove("modal-in");
        controller.classList.add("modal-out");
        setTimeout(() => {
          document.body.removeChild(host);
        }, 200);
      } else {
        document.body.removeChild(host);
      }
    }
  }, 2000);
  createAnalyticsEvent(LegacyAnalyticsEvent.CmdMenuScanQRCodeNoneFound);
}

async function showUnifiedAutofillModal(extensionContext: ExtensionContext, startOnAddressTab = false): Promise<void> {
  if (
    noOtherModalsShowing() &&
    (extensionContext.creditCards.length || extensionContext.addresses.length) &&
    keepAutofillClosed == false &&
    extensionContext.saveAddShowing === false &&
    extensionContext.saveCCShowing === false
  ) {
    keepAutofillClosed = true;
    const { shadow, host } = await createModalFromTemplate(
      "modals/autofill_unified_tabs.html",
      "uno-unified-autofill-modal",
    );

    const kbListeners: Array<(e: KeyboardEvent) => void> = [];

    const scrollingOptions = shadow.getElementById("scrolling-options");
    if (scrollingOptions) {
      scrollingOptions.onscroll = (e) => {
        e.preventDefault();
      };
    }

    // Credit cards section
    const cardsContainer = shadow.getElementById("cards-container");
    if (cardsContainer) {
      extensionContext.creditCards.forEach((creditCard, index) => {
        // Fill out card name
        let cardName = "";
        if (creditCard.name) {
          cardName = creditCard.name;
        } else {
          const ccTypeInfo = creditCardType(creditCard.number);
          cardName = generateCardName(creditCard.number, ccTypeInfo);
        }

        cardsContainer.innerHTML += getCCAutoFillHTML(
          cardName,
          creditCard.number.slice(-4),
          creditCard.type || "",
          index + 1,
        );

        // Yikes, but we have to make some tweaks to the generic svgs
        // The alternative would be to have svgs for the saveCC modal and the autofill modal
        cardsContainer.children[cardsContainer.children.length - 1].children[0].children[0].children[0].setAttribute(
          "width",
          "28",
        );
        cardsContainer.children[cardsContainer.children.length - 1].children[0].children[0].children[0].setAttribute(
          "height",
          "22",
        );
        cardsContainer.children[cardsContainer.children.length - 1].children[0].children[0].children[0].classList.add(
          "autofillCCBig-badge",
        );
      });

      const ccc = cardsContainer.cloneNode(true);
      cardsContainer.replaceWith(ccc);
      const newCC = shadow.getElementById("cards-container");

      // Set on click handler for autofilling
      if (newCC) {
        for (const card of newCC.children) {
          const cardIndex = card.getAttribute("cardIndex");
          if (cardIndex) {
            const ci = parseInt(cardIndex);
            const vaultCard = extensionContext.creditCards[ci - 1];
            card.addEventListener("click", () => {
              keepAutofillClosed = true;
              doAutofillForCard(inputsOfType, vaultCard);

              chrome.runtime.sendMessage(
                messageToJSON({
                  kind: "DO_CC_AUTOFILL_IN_IFRAME",
                  payload: vaultCard,
                }),
              );

              removeModalAndListener(host, shadow, keyupHandler);
              kbListeners.forEach((kbListener) => {
                document.removeEventListener("keydown", kbListener);
              });
            });
          }
        }
      }
    }

    // Addresses section
    const addContainer = shadow.getElementById("autofill-address-container");
    if (addContainer) {
      extensionContext.addresses.forEach((address, index) => {
        // TODO: MAKE SURE WORKS ON SAFARI CSS BUG PAGES
        const autofillAddBtn = document.createElement("button");
        const addIndex = index + 1;
        autofillAddBtn.id = `uno-add-${addIndex}`;
        autofillAddBtn.setAttribute("addIndex", `${addIndex}`);

        autofillAddBtn.innerHTML = getAddAutofillHTML(address.line1);
        addContainer.appendChild(autofillAddBtn);
      });

      // Set on click handler for autofilling
      for (const add of addContainer.children) {
        const addIndex = add.getAttribute("addIndex");
        if (addIndex) {
          const ai = parseInt(addIndex);
          const vaultAdd = extensionContext.addresses[ai - 1];
          add.addEventListener("click", () => {
            keepAutofillClosed = true;
            doAutofillForAddress(inputsOfType, vaultAdd);
          });
        }
      }
    }

    // Switch tabs logic
    const ccTabDisabled = shadow.getElementById("cc-tab-disabled");
    const addTabDisabled = shadow.getElementById("address-tab-disabled");
    if (ccTabDisabled && addTabDisabled) {
      addTabDisabled.onclick = () => {
        switchToAddressTab(shadow);
      };

      ccTabDisabled.onclick = () => {
        switchToCreditCardTab(shadow);
      };
    }

    if (startOnAddressTab) {
      switchToAddressTab(shadow);
    }

    // Disable the cc tab if we don't have credit cards
    if (extensionContext.creditCards.length === 0) {
      switchToAddressTab(shadow);
      const ccDisabledTab = shadow.getElementById("cc-tab-disabled");
      if (ccDisabledTab) {
        ccDisabledTab.onclick = null;
      }
    }

    if (extensionContext.addresses.length === 0) {
      switchToCreditCardTab(shadow);
      const addDisabledTab = shadow.getElementById("address-tab-disabled");
      if (addDisabledTab) {
        addDisabledTab.onclick = null;
      }
    }

    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        keepAutofillClosed = true;
        removeModalAndListener(host, shadow, keyupHandler);
        kbListeners.forEach((kbListener) => {
          document.removeEventListener("keydown", kbListener);
        });
      };
    }

    const keyupHandler = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        keepAutofillClosed = true;
        removeModalAndListener(host, shadow, keyupHandler);
      }
    };
    document.addEventListener("keydown", keyupHandler);

    waitForModalStylesToLoad(shadow);
    createAnalyticsEvent(LegacyAnalyticsEvent.UnifiedAutofillDisplayed);
  }
}

function switchToAddressTab(shadow: ShadowRoot) {
  const addContainer = shadow.getElementById("autofill-address-container");
  const cardsContainer = shadow.getElementById("cards-container");
  const ccTabEnabled = shadow.getElementById("cc-tab-enabled");
  const ccTabDisabled = shadow.getElementById("cc-tab-disabled");
  const addTabEnabled = shadow.getElementById("address-tab-enabled");
  const addTabDisabled = shadow.getElementById("address-tab-disabled");

  if (ccTabEnabled && ccTabDisabled && addTabEnabled && addTabDisabled) {
    ccTabEnabled.style.display = "none";
    ccTabDisabled.style.display = "flex";

    addTabDisabled.style.display = "none";
    addTabEnabled.style.display = "flex";

    if (addContainer && cardsContainer) {
      addContainer.style.display = "flex";
      cardsContainer.style.display = "none";
    }
  }
}

function switchToCreditCardTab(shadow: ShadowRoot) {
  const addContainer = shadow.getElementById("autofill-address-container");
  const cardsContainer = shadow.getElementById("cards-container");
  const ccTabEnabled = shadow.getElementById("cc-tab-enabled");
  const ccTabDisabled = shadow.getElementById("cc-tab-disabled");
  const addTabEnabled = shadow.getElementById("address-tab-enabled");
  const addTabDisabled = shadow.getElementById("address-tab-disabled");

  if (ccTabEnabled && ccTabDisabled && addTabEnabled && addTabDisabled) {
    ccTabEnabled.style.display = "flex";
    ccTabDisabled.style.display = "none";

    addTabDisabled.style.display = "flex";
    addTabEnabled.style.display = "none";

    if (addContainer && cardsContainer) {
      cardsContainer.style.display = "flex";
      addContainer.style.display = "none";
    }
  }
}
const delay = 500; // anti-rebound for 500ms
let lastExecution = 0;

async function showSaveAddressModal(
  extensionContext: ExtensionContext,
  inputsOfType: Array<InputWithType>,
  sequencedModal: boolean,
  fromContext = false,
) {
  if (lastExecution + delay < Date.now()) {
    lastExecution = Date.now();

    // Keep other modals closed
    keepAutofillClosed = true;
    keepMagicLoginClosed = true;
    keepSuggestStrongPWClosed = true;

    closeAllOtherModals(extensionContext);

    extensionContext.saveAddShowing = true;
    updateExtensionContext(extensionContext);

    const { shadow, host } = await createModalFromTemplate("modals/save_address.html", "uno-save-addresses-modal");

    if (sequencedModal) {
      const stepTwoOfTwo = shadow.getElementById("sequenced-modal");
      if (stepTwoOfTwo) {
        stepTwoOfTwo.style.display = "flex";
      }
    }

    // Get all the modal inputs
    const ln1Element = shadow.getElementById("address-1") as HTMLInputElement | null;
    const ln2Element = shadow.getElementById("address-2") as HTMLInputElement | null;
    const cityElement = shadow.getElementById("address-city") as HTMLInputElement | null;
    const zipElement = shadow.getElementById("address-zip") as HTMLInputElement | null;
    const stateElement = shadow.getElementById("address-state") as HTMLInputElement | null;
    const countryElement = shadow.getElementById("address-country") as HTMLInputElement | null;

    // If modal is already showing but page refreshed
    if (fromContext) {
      if (extensionContext.saveAddStreet && ln1Element) {
        ln1Element.value = extensionContext.saveAddStreet;
      }
      if (extensionContext.saveAddLine2 && ln2Element) {
        ln2Element.value = extensionContext.saveAddLine2;
      }
      if (extensionContext.saveAddCity && cityElement) {
        cityElement.value = extensionContext.saveAddCity;
      }
      if (extensionContext.saveAddZip && zipElement) {
        zipElement.value = extensionContext.saveAddZip;
      }
      if (extensionContext.saveAddState && stateElement) {
        stateElement.value = extensionContext.saveAddState;
      }
      if (extensionContext.saveAddCountry && countryElement) {
        countryElement.value = extensionContext.saveAddCountry;
      }
    } else {
      // Fill in modal with data from inputs that we found
      inputsOfType.forEach((inputOfType) => {
        switch (inputOfType.type) {
          case INPUT_TYPE_STREET_ADDRESS:
            if (ln1Element) {
              ln1Element.value = inputOfType.input.value;
              extensionContext.saveAddStreet = inputOfType.input.value;
            }
            break;
          case INPUT_TYPE_ADDRESS_LINE_2:
            if (ln2Element) {
              ln2Element.value = inputOfType.input.value;
              extensionContext.saveAddLine2 = inputOfType.input.value;
            }
            break;
          case INPUT_TYPE_CITY:
            if (cityElement) {
              cityElement.value = inputOfType.input.value;
              extensionContext.saveAddCity = inputOfType.input.value;
            }
            break;
          case INPUT_TYPE_ZIP_CODE:
            if (zipElement) {
              zipElement.value = inputOfType.input.value;
              extensionContext.saveAddZip = inputOfType.input.value;
            }
            break;
          case INPUT_TYPE_STATE:
            if (stateElement) {
              stateElement.value = inputOfType.input.value;
              extensionContext.saveAddState = inputOfType.input.value;
            }
            break;
          case INPUT_TYPE_COUNTRY:
            if (countryElement) {
              countryElement.value = inputOfType.input.value;
              extensionContext.saveAddCountry = inputOfType.input.value;
            }
            break;
        }
      });
      updateExtensionContext(extensionContext);
    }

    const addForm = shadow.getElementById("save-address-form") as HTMLFormElement | null;
    if (addForm) {
      addForm.onsubmit = (e: Event) => {
        e.preventDefault();

        const addressData: any = { id: uuidv4() };

        const modalFormData = new FormData(addForm);
        for (const [name, value] of modalFormData) {
          if (name === "line1") {
            addressData[name] = value.toString();
          } else if (name === "line2") {
            addressData[name] = value.toString();
          } else if (name === "city") {
            addressData[name] = value.toString();
          } else if (name === "zip") {
            addressData[name] = value.toString();
          } else if (name === "state") {
            addressData[name] = value.toString();
          } else if (name === "country") {
            addressData[name] = value.toString();
          }
        }

        chrome.runtime.sendMessage(
          messageToJSON({
            kind: "SAVE_ADDRESS",
            address: addressData,
          }),
        );
        createAnalyticsEvent(LegacyAnalyticsEvent.AddressSaved);
        removeModalAndListener(host, shadow, keyupHandler);
        extensionContext.saveAddShowing = false;
        updateExtensionContext(extensionContext);
      };
      addForm.onchange = (e: Event) => {
        e.preventDefault();
      };
    }

    const closeModalBtn = shadow.getElementById("close-overlay");
    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        removeModalAndListener(host, shadow, keyupHandler);
        extensionContext.saveAddShowing = false;
        resetAddressState(extensionContext);
        updateExtensionContext(extensionContext);
      };
    }

    const keyupHandler = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        removeModalAndListener(host, shadow, keyupHandler);
        resetAddressState(extensionContext);
        updateExtensionContext(extensionContext);
      }
    };
    document.addEventListener("keydown", keyupHandler);
    waitForModalStylesToLoad(shadow, async () => {
      const referenceElement = shadow.getElementById("uno-modal-controller");
      if (referenceElement) {
        await v2Orchestrator?.useAction(ViewSaveAddressHint)({
          root: generateCssSelector(shadow.host),
          referenceElement: generateCssSelector(referenceElement),
          offset: 20,
          placement: "right",
        });
      }
    });
    createAnalyticsEvent(LegacyAnalyticsEvent.AddressSaveDisplayed);
  }
}

async function showSaveCreditCardModal(
  extensionContext: ExtensionContext,
  sequencedModal: boolean,
  inputsOfType: Array<InputWithType>,
  fromContext = false,
): Promise<void> {
  closeAllOtherModals(extensionContext);
  extensionContext.saveCCShowing = true;
  updateExtensionContext(extensionContext);

  const { shadow, host } = await createModalFromTemplate("modals/save_credit_card.html", "uno-save-credit-card-modal");

  if (sequencedModal) {
    const stepOneOfTwo = shadow.getElementById("sequenced-modal");
    if (stepOneOfTwo) {
      stepOneOfTwo.style.display = "flex";
    }
  }

  // Get all the modal inputs
  const creditCardNameElement = shadow.getElementById("credit-card-name") as HTMLInputElement | null;
  const cardNumberElement = shadow.getElementById("credit-card-number") as HTMLInputElement | null;
  const cardExpElement = shadow.getElementById("credit-card-expiration-date") as HTMLInputElement | null;
  const cardCVCElement = shadow.getElementById("credit-card-cvc") as HTMLInputElement | null;
  const cardHolderNameElement = shadow.getElementById("credit-card-holder-name") as HTMLInputElement | null;

  // Put in the / for MM/YY
  if (cardExpElement) {
    cardExpElement.oninput = (e) => {
      const targetInput = e.target as HTMLInputElement;
      if (targetInput.value.length === 2 && targetInput.value.includes("/") === false) {
        targetInput.value += "/";
      }
    };
  }

  // If modal is already showing but page refreshed
  if (fromContext) {
    if (extensionContext.saveCCCardName && creditCardNameElement) {
      creditCardNameElement.value = extensionContext.saveCCCardName;
    }
    if (extensionContext.saveCCCardNumber && cardNumberElement) {
      cardNumberElement.value = `**** **** **** ${extensionContext.saveCCCardNumber.slice(-4)}`;
      const ccTypeInfo = creditCardType(extensionContext.saveCCCardNumber);
      updateBadgeBasedOnType(shadow, ccTypeInfo);
    }
    if (extensionContext.saveCCExpiration && cardExpElement) {
      let formattedExp = extensionContext.saveCCExpiration;
      if (formattedExp.length === 4 && formattedExp.includes("/") === false) {
        formattedExp = [formattedExp.slice(0, 2), "/", formattedExp.slice(2)].join("");
      }
      formattedExp = formattedExp.replace(/ /g, "");
      cardExpElement.value = formattedExp;
    }
    if (extensionContext.saveCCCVC && cardCVCElement) {
      cardCVCElement.value = extensionContext.saveCCCVC;
    }
    if (extensionContext.saveCCHolderName && cardHolderNameElement) {
      cardHolderNameElement.value = extensionContext.saveCCHolderName;
    }
  } else {
    // Fill in modal with data from inputs that we found
    inputsOfType.forEach((inputOfType) => {
      switch (inputOfType.type) {
        case INPUT_TYPE_CREDIT_CARD_NUMBER:
          if (cardNumberElement) {
            const creditCardNumber = onlyNumbers(inputOfType.input.value);

            // regex to match 16 numbers
            const ccNumberRegex = new RegExp("^[0-9]{16}$");
            // TODO; what should do we do if not properly formatted?
            if (ccNumberRegex.test(creditCardNumber) === true) {
              // Fill in modal card number with asteriks except last 4
              cardNumberElement.value = `**** **** **** ${creditCardNumber.slice(-4)}`;
              extensionContext.saveCCCardNumber = creditCardNumber;

              // Update little cc badge to type of card
              const ccTypeInfo = creditCardType(creditCardNumber);
              updateBadgeBasedOnType(shadow, ccTypeInfo);

              // Generate card name based on card number and type
              if (creditCardNameElement) {
                const cardName = generateCardName(creditCardNumber, ccTypeInfo);
                creditCardNameElement.value = cardName;
                extensionContext.saveCCCardName = cardName;
              }
            }
          }
          break;
        case INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE:
          if (cardExpElement) {
            cardExpElement.value = inputOfType.input.value.replace(/ /g, "");
            extensionContext.saveCCExpiration = inputOfType.input.value;
          }
          break;
        case INPUT_TYPE_CREDIT_CARD_CVC:
          if (cardCVCElement) {
            cardCVCElement.value = inputOfType.input.value;
            extensionContext.saveCCCVC = inputOfType.input.value;
          }
          break;
        case INPUT_TYPE_CREDIT_CARD_HOLDER_NAME:
          if (cardHolderNameElement) {
            cardHolderNameElement.value = inputOfType.input.value;
            extensionContext.saveCCHolderName = inputOfType.input.value;
          }
          break;
      }
    });
    updateExtensionContext(extensionContext);
  }

  decorateEmptyCCFields(shadow);

  const ccForm = shadow.getElementById("uno-credit-card-form") as HTMLFormElement | null;
  if (ccForm) {
    ccForm.onsubmit = (e: Event) => {
      e.preventDefault();

      const creditCardData: any = { id: uuidv4() };

      const modalFormData = new FormData(ccForm);
      for (const [name, value] of modalFormData) {
        if (name === "name") {
          creditCardData[name] = value.toString();
        } else if (name === "holder") {
          creditCardData[name] = value.toString();
        } else if (name === "number" && extensionContext.saveCCCardNumber) {
          creditCardData[name] = extensionContext.saveCCCardNumber;
          const ccTypeInfo = creditCardType(extensionContext.saveCCCardNumber);
          if (ccTypeInfo[0]) {
            creditCardData.type = ccTypeInfo[0].type;
          }
        } else if (name === "expiration") {
          creditCardData[name] = value.toString().replace("/", "");
        } else if (name === "cvv") {
          creditCardData[name] = value.toString();
        }
      }

      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "SAVE_CREDIT_CARD",
          creditCard: creditCardData,
        }),
      );
      createAnalyticsEvent(LegacyAnalyticsEvent.CreditCardSaved);
      removeModalAndListener(host, shadow, keyupHandler);
      extensionContext.saveCCShowing = false;
      updateExtensionContext(extensionContext);

      if (sequencedModal) {
        showSaveAddressModal(extensionContext, inputsOfType, true, fromContext);
      }
    };
    ccForm.onchange = (e: Event) => {
      e.preventDefault();
    };
  }

  const closeModalBtn = shadow.getElementById("close-overlay");
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      removeModalAndListener(host, shadow, keyupHandler);
      resetCreditCardState(extensionContext);
      updateExtensionContext(extensionContext);

      if (sequencedModal) {
        showSaveAddressModal(extensionContext, inputsOfType, true, fromContext);
      }
    };
  }

  const keyupHandler = async (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      removeModalAndListener(host, shadow, keyupHandler);
      resetCreditCardState(extensionContext);
      updateExtensionContext(extensionContext);

      if (sequencedModal) {
        showSaveAddressModal(extensionContext, inputsOfType, true, fromContext);
      }
    }
  };
  document.addEventListener("keydown", keyupHandler);
  waitForModalStylesToLoad(shadow, async () => {
    const referenceElement = shadow.getElementById("uno-modal-controller");
    if (referenceElement) {
      await v2Orchestrator?.useAction(ViewSaveCreditCardHint)({
        root: generateCssSelector(shadow.host),
        referenceElement: generateCssSelector(referenceElement),
        offset: 20,
        placement: "right",
      });
    }
  });
  createAnalyticsEvent(LegacyAnalyticsEvent.CreditCardSaveModalDisplayed);
}

function resetCreditCardState(extensionContext: ExtensionContext) {
  extensionContext.saveCCShowing = false;
  extensionContext.saveCCCVC = null;
  extensionContext.saveCCCardName = null;
  extensionContext.saveCCCardNumber = null;
  extensionContext.saveCCHolderName = null;
  extensionContext.saveCCExpiration = null;
}

function resetAddressState(extensionContext: ExtensionContext) {
  extensionContext.saveAddShowing = false;
  extensionContext.saveAddStreet = null;
  extensionContext.saveAddLine2 = null;
  extensionContext.saveAddCity = null;
  extensionContext.saveAddState = null;
  extensionContext.saveAddZip = null;
  extensionContext.saveAddCountry = null;
}

const decorateEmptyCCFields = (shadow: ShadowRoot) => {
  const creditCardNameElement = shadow.getElementById("credit-card-name") as HTMLInputElement | null;
  const cardNumberElement = shadow.getElementById("credit-card-number") as HTMLInputElement | null;
  const cardExpElement = shadow.getElementById("credit-card-expiration-date") as HTMLInputElement | null;
  const cardCVCElement = shadow.getElementById("credit-card-cvc") as HTMLInputElement | null;
  const cardHolderNameElement = shadow.getElementById("credit-card-holder-name") as HTMLInputElement | null;

  if (creditCardNameElement && creditCardNameElement.value === "") {
    creditCardNameElement.innerHTML += commonSVGs.SVG_MISSING_INFO;
    creditCardNameElement.innerHTML += `<span style="margin-left: 4px;font-weight: 510;font-size: 10px;line-height: 12px;color: #FC511F;">Name for this Credit Card</span>`;
    safariIze(creditCardNameElement);
  }

  if (cardNumberElement && cardNumberElement.value === "") {
    cardNumberElement.innerHTML += commonSVGs.SVG_MISSING_INFO;
    cardNumberElement.innerHTML += `<span style="margin-left: 4px;font-weight: 510;font-size: 10px;line-height: 12px;color: #FC511F;">Card Number</span>`;
    safariIze(cardNumberElement);
  }

  if (cardExpElement && cardExpElement.value === "") {
    cardExpElement.innerHTML += commonSVGs.SVG_MISSING_INFO;
    cardExpElement.innerHTML += `<span style="margin-left: 4px;font-weight: 510;font-size: 10px;line-height: 12px;color: #FC511F;">MM/YY</span>`;
    safariIze(cardExpElement);
  }

  if (cardCVCElement && cardCVCElement.value === "") {
    cardCVCElement.innerHTML += commonSVGs.SVG_MISSING_INFO;
    cardCVCElement.innerHTML += `<span style="margin-left: 4px;font-weight: 510;font-size: 10px;line-height: 12px;color: #FC511F;">CVC</span>`;
    safariIze(cardCVCElement);
  }

  if (cardHolderNameElement && cardHolderNameElement.value === "") {
    cardHolderNameElement.innerHTML += commonSVGs.SVG_MISSING_INFO;
    cardHolderNameElement.innerHTML += `<input class="pc" placeholder="Cardholder's name" style="margin-left: 4px;font-weight: 510;font-size: 10px;line-height: 12px;color: #FC511F;">`;
    safariIze(cardHolderNameElement);
  }
};

const updateBadgeBasedOnType = (shadow: ShadowRoot, ccTypeInfo: CreditCardType[]) => {
  const badgeContainer = shadow.getElementById("cc-badge-container");
  if (ccTypeInfo.length && badgeContainer) {
    const badgeSVG = getBadgeSVG(ccTypeInfo[0].type);
    badgeContainer.innerHTML = badgeSVG;
    safariIze(badgeContainer);
  }
};

const getBadgeSVG = (badgeType: string) => {
  switch (badgeType) {
    case "visa":
      return VISA;
    case "mastercard":
      return MASTERCARD;
    case "american-express":
      return AMEX;
    case "diners-club":
      return DINERS_CLUB;
    case "discover":
      return DISCOVER;
    case "jcb":
      return JCB;
    case "maestro":
      return MAESTRO;
    case "unionpay":
      return UNION_PAY;
    default:
      return GENERIC;
  }
};

export const hideMagicLoginModal = (extensionContext: ExtensionContext) => {
  const magicLoginModal = document.getElementById("uno-magic-modal");
  if (magicLoginModal) {
    const shadow = magicLoginModal.shadowRoot;
    if (shadow) {
      const controller = shadow.getElementById("uno-modal-controller");
      if (controller) {
        controller.classList.remove("modal-in");
        controller.classList.add("modal-out");
        setTimeout(() => {
          try {
            document.body.removeChild(magicLoginModal);
          } catch (e) {
            console.log(e);
          }
        }, 200);
      } else {
        document.body.removeChild(magicLoginModal);
      }
    }
  }
  extensionContext.magicLoginShowing = false;
  updateExtensionContext(extensionContext);
};

const hideSuggestStrongPWModal = () => {
  const suggestStrongPWModal = document.getElementById("suggest-strong-password-container");
  if (suggestStrongPWModal) {
    document.body.removeChild(suggestStrongPWModal);
  }
};

const removeModalAndListener = (host: HTMLDivElement, shadow: ShadowRoot, keyupHandler: (e: KeyboardEvent) => void) => {
  try {
    const controller = shadow.getElementById("uno-modal-controller");
    if (controller) {
      controller.classList.remove("modal-in");
      controller.classList.add("modal-out");
      setTimeout(() => {
        try {
          document.body.removeChild(host);
        } catch (e) {
          console.log("Couldn't remove host", host);
        }
      }, 200);
    } else {
      document.body.removeChild(host);
    }
    document.removeEventListener("keyup", keyupHandler);
    document.removeEventListener("keydown", keyupHandler);

    if (isDemoHost) {
      hideDemoSpotlight();
    }
  } catch (e) {
    console.log("Couldn't remove host", e);
  }
};

// To avoid attempting to scan every img, canvas, etc that shows up on the page we're trying to be sure
// that we're on a qr code scan page first
function onScanQRPage() {
  const html = document.body.outerHTML.toLowerCase();
  if (
    // Commented this out for now.  It was picking up too much
    // We can reconsider it when we move to mutationObserver
    // html.includes("qr code") ||
    html.includes("authentication app") ||
    html.includes("authenticator app") ||
    html.includes("third party authenticator") ||
    html.includes("set up two-factor authentication") ||
    html.includes("scan this code") ||
    html.includes("add 2 factor authentication") ||
    html.includes("set up 2 factor authentication")
  ) {
    return true;
  }
  return false;
}

function save2FAToAccount(vaultItemID: VaultItemId, seed: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "SAVE_2FA_EXISTING_ACCOUNT",
        vaultItemID,
        seed,
        currentLocation: window.location,
      }),

      function (r) {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "SAVE_2FA_EXISTING_ACCOUNT_SUCCESS":
            extensionContext = message.extensionContext;
            createAnalyticsEvent(LegacyAnalyticsEvent.QRCodeSaved);
            if (isDemoHost) {
              createAnalyticsEvent(LegacyAnalyticsEvent.Demo2faAdded);
            }
            resolve(true);
            break;
          case "SAVE_2FA_EXISTING_ACCOUNT_FAIL":
            resolve(false);
            break;
          default:
            resolve(false);
            break;
        }
      },
    );
  });
}

// Criteria to show save login:
// 1. New account (unseen username) in vault
function saveLoginCriteriaMet(
  usernameInput: HTMLInputElement | undefined,
  passwordInput: HTMLInputElement | undefined,
  extensionContext: ExtensionContext,
): boolean {
  const userValue = usernameInput?.value;
  const pwValue = passwordInput?.value;

  // If we don't have values, don't show the modal
  if (!userValue || !pwValue) {
    return false;
  }

  if (extensionContext.saveLoginShowing) {
    return false;
  }

  // Check if the username entered is in the vault for this site
  let vaultItemForEnteredUsername: LoginItem | null = null;
  extensionContext.siteVaultItems.forEach((vaultItem) => {
    if (vaultItem.username === userValue) {
      vaultItemForEnteredUsername = vaultItem;
    }
  });

  // If we don't have a vault item for this site, we are going to show the modal
  if (vaultItemForEnteredUsername === null) {
    return true;
  }

  return false;
}

// Criteria to show update login:
// Password changed for existing account
function updateLoginCriteriaMet(
  usernameInput: HTMLInputElement | undefined,
  passwordInput: HTMLInputElement | undefined,
  extensionContext: ExtensionContext,
): boolean {
  const userValue = usernameInput?.value;
  const pwValue = passwordInput?.value;

  // If we don't have values, don't show the modal
  if (!userValue || !pwValue) {
    return false;
  }

  if (extensionContext.saveLoginShowing) {
    return false;
  }

  // Check if the username entered is in the vault for this site
  let vaultItemForEnteredUsername: LoginItem | null = null;
  let passwordChanged = false;
  extensionContext.siteVaultItems.forEach((vaultItem) => {
    if (vaultItem.username === userValue) {
      vaultItemForEnteredUsername = vaultItem;
      if (vaultItemForEnteredUsername.password !== pwValue) {
        passwordChanged = true;
      }
    }
  });

  // Existing item, password changed
  if (vaultItemForEnteredUsername !== null && passwordChanged) {
    return true;
  }

  return false;
}

function updateExtensionContext(updatedExtensionContext: ExtensionContext) {
  chrome.runtime.sendMessage(
    messageToJSON({
      kind: "UPDATE_EXTENSION_CONTEXT",
      extensionContext: updatedExtensionContext,
    }),
    function (r) {
      try {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "UPDATE_EXTENSION_CONTEXT_SUCCESS":
            extensionContext = message.extensionContext;
            break;
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (e) {
        console.error("Error updating extension context", e);
      }
    },
  );
}

function updateVaultForSaveLogin(updatedExtensionContext: ExtensionContext) {
  if (updatedExtensionContext.saveLoginUsername && updatedExtensionContext.saveLoginPassword) {
    // When saving new password, we don't want to bring up the modal anymore
    suggestStrongPwOpen = false;
    saveLoginSaved = true;
    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "SAVE_LOGIN",
        extensionContext: updatedExtensionContext,
      }),
      function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "SAVE_LOGIN_SUCCESS":
              extensionContext = message.extensionContext;
              createAnalyticsEvent(LegacyAnalyticsEvent.SaveLoginSaved);
              break;
          }
        } catch (e) {
          console.log(e);
        }
      },
    );

    if (isDemoHost) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DemoPasswordAutofilled);
    }
  }
}

function updateVaultForSaveSSO(updatedExtensionContext: ExtensionContext) {
  if (updatedExtensionContext.saveSSOChoice) {
    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "SAVE_SSO",
        extensionContext: updatedExtensionContext,
      }),

      function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "SAVE_SSO_SUCCESS":
              extensionContext = message.extensionContext;
              break;
          }
        } catch (e) {
          console.log(e);
        }
      },
    );
  }
}

function startModalTimer(MS: number, extensionContext: ExtensionContext) {
  skipIterations = MS / 1000;
  extensionContext.modalTickTime = MS;
  if (modalTimer === null) {
    modalTimer = setInterval(() => {
      if (extensionContext.modalTickTime) {
        extensionContext.modalTickTime -= 100;
        // Timers up
        if (
          extensionContext.modalTickTime < 100 &&
          (extensionContext.saveLoginShowing === true || extensionContext.saveSSOShowing === true)
        ) {
          // Remove modal
          const modalContainer = document.getElementById("uno-save-container");
          if (modalContainer) {
            document.body.removeChild(modalContainer);
            expireModalTimer(extensionContext);
            hideDemoSpotlight();
          }

          // Cancel interval timer
          if (modalTimer) {
            skipIterations = 1;
            clearInterval(modalTimer);
            modalTimer = null;
          }

          if (extensionContext.saveLoginShowing) {
            updateVaultForSaveLogin(extensionContext);
          } else if (extensionContext.saveSSOShowing && extensionContext.saveSSOChoice) {
            updateVaultForSaveSSO(extensionContext);
          }

          extensionContext.saveLoginShowing = false;
          extensionContext.saveSSOShowing = false;
          extensionContext.modalTickTime = 15_000;
          updateExtensionContext(extensionContext);
        }

        updateModalTimerDisplay(extensionContext.modalTickTime);
        updateExtensionContext(extensionContext);
      }
    }, 100);
  }
}

function updateModalTimerDisplay(progressVaule: number) {
  const shadowContainer = document.getElementById("uno-save-container");
  if (shadowContainer) {
    const shadow = shadowContainer.shadowRoot;
    if (shadow) {
      const modalTime = shadow.getElementById("modal-timer");
      if (modalTime) {
        modalTime.style.setProperty("width", `${((15000 - progressVaule) / 15000) * 100}%`);
      }
    }
  }
}

function expireModalTimer(extensionContext: ExtensionContext) {
  // If the timer is going and is under 100, it will cancel itself
  extensionContext.modalTickTime = 99;
}

export const resetMagicLoginState = (extensionContext: ExtensionContext) => {
  magicLoginEventListeners.forEach((listener) => {
    document.removeEventListener("keydown", listener);
  });
  magicLoginEventListeners = [];
  extensionContext.magicLoginAccountSelected = null;
  extensionContext.magicLoginInitiated = false;
  extensionContext.magicLoginShowing = false;
  extensionContext.magicLoginSSOChoice = null;
  extensionContext.userNameInputted = false;
  extensionContext.passwordInputted = false;
  extensionContext.submitButtonClicked = false;
  extensionContext.mfaCodeEntered = false;
  updateExtensionContext(extensionContext);
};

const resetSaveLoginState = (extensionContext: ExtensionContext) => {
  extensionContext.saveLoginHostname = null;
  extensionContext.saveLoginUsername = null;
  extensionContext.saveLoginPassword = null;
  extensionContext.saveLoginShowing = false;
  extensionContext.saveSSOShowing = false;
  extensionContext.magicLoginSSOChoice = null;
  updateExtensionContext(extensionContext);
};

const isLoginPage = (usernameInput?: HTMLInputElement | null, passwordInput?: HTMLInputElement | null): boolean => {
  const path = window.location.pathname.toLowerCase().trim();

  // Don't include password reset pages
  if (path.includes("/password/reset")) {
    return false;
  }

  // Don't include sign up pages
  const bodyHTML = document.body.innerHTML.toLowerCase();
  if (hasSignUpVerbiage(bodyHTML)) {
    return false;
  }

  if (
    path.includes("login") ||
    path.includes("signin") ||
    path.includes("oauth2/auth") ||
    path.includes("/sign_in") ||
    path.includes("/sign-in") ||
    path.includes("/log-in")
  ) {
    return true;
  }

  const hash = window.location.hash.toLowerCase().trim();
  if (hash.includes("login") || hash.includes("signin")) {
    return true;
  }

  if (usernameInput && passwordInput) {
    return true;
  }

  const queryString = window.location.search.toLowerCase().trim();
  if (queryString.includes("login") || queryString.includes("signin")) {
    return true;
  }

  return false;
};

const isSignupPage = (): boolean => {
  const path = window.location.href.toLowerCase().trim();
  if (
    path.includes("/signup") ||
    path.includes("/sign_up") ||
    path.includes("/sign-up") ||
    path.includes("/create-account") ||
    path.includes("/register") ||
    path.includes("/freesignup") ||
    path.includes("/join")
  ) {
    return true;
  }

  // Look for text regarding privacy & TOS
  const bodyHTML = document.body.innerHTML.toLowerCase();
  if (hasSignUpVerbiage(bodyHTML)) {
    return true;
  }

  // Other text that can indicate signing up
  if (bodyHTML.includes("finish signing up")) {
    return true;
  }

  return false;
};

const findVaultForUsername = (vaultItems: LoginItem[], username: string): LoginItem | null => {
  let matchingVaultItem = null;
  vaultItems.forEach((vaultItem) => {
    if (vaultItem.username === username) {
      matchingVaultItem = vaultItem;
    }
  });
  return matchingVaultItem;
};

// Given SSO buttons & a provider, try to pick the SSO button for that provider
function filterSSOProviderBtn(
  ssoButtons: HTMLElement[] | null,
  ssoProvider: SupportedSSOProviders,
): HTMLElement | null {
  if (ssoButtons) {
    const ssoBtns = ssoButtons.filter((ssoButton) => {
      const html = ssoButton.outerHTML.toLowerCase().trim();
      const href = ssoButton.getAttribute("href");
      const innerText = ssoButton.innerText.toLowerCase().trim();

      return (
        (html.includes(`continue with ${ssoProvider}`) ||
          html.includes(`log in using ${ssoProvider}`) ||
          html.includes(`log in with ${ssoProvider}`) ||
          html.includes(`login with ${ssoProvider}`) ||
          html.includes(`sign in with ${ssoProvider}`) ||
          html.includes(`signin with ${ssoProvider}`) ||
          innerText.includes(`continue with ${ssoProvider}`) ||
          innerText.includes(`log in using ${ssoProvider}`) ||
          innerText.includes(`log in with ${ssoProvider}`) ||
          innerText.includes(`login with ${ssoProvider}`) ||
          innerText.includes(`sign in with ${ssoProvider}`) ||
          innerText.includes(`signin with ${ssoProvider}`) ||
          (href && href.toLowerCase().includes(`/signin/${ssoProvider}`)) ||
          (href && href.toLowerCase().includes(`/auth/authorize`)) ||
          ssoButton.innerText.toLowerCase().trim() === ssoProvider ||
          // google specific
          (ssoProvider === SupportedSSOProviders.Google && ssoButton.id.toLowerCase().trim().includes("g-signin"))) &&
        isElementVisible(ssoButton)
      );
    });

    // prioritize divs that are role button
    const divButtons = ssoBtns.filter((ssoBtn) => {
      const role = ssoBtn.getAttribute("role");
      if (role?.toLowerCase() === "button") {
        return ssoBtn;
      }
    });

    if (divButtons.length === 1) {
      return divButtons[0];
    }

    // If we come back with more than one, pick the first one
    // findSSOBtns aggregates the sso buttons with priority in mind
    if (ssoBtns.length >= 1) {
      return ssoBtns[0];
    }
  }

  return null;
}

function findSSOBtns(
  inputs: HTMLInputElement[],
  buttons: HTMLButtonElement[],
  divs: HTMLDivElement[],
  anchors: HTMLAnchorElement[],
  iframes: HTMLIFrameElement[],
): HTMLElement[] | null {
  let returnElements: HTMLElement[] = [];

  const filteredBtns = buttons.filter((button) => {
    const innerText = button.innerText.toLowerCase().trim().trim();
    return (
      // Apple
      innerText === "continue with apple" ||
      innerText === "log in using apple" ||
      innerText === "log in with apple" ||
      innerText === "login with apple" ||
      innerText === "sign in with apple" ||
      innerText === "signin with apple" ||
      innerText === "signup with apple" ||
      innerText === "sign up with apple" ||
      innerText === "signup using apple" ||
      innerText === "sign up using apple" ||
      innerText === "apple" ||
      button.ariaLabel?.toLowerCase().trim() === "continue with apple" ||
      // Google
      innerText === "continue with google" ||
      innerText === "log in using google" ||
      innerText === "log in with google" ||
      innerText === "login with google" ||
      innerText === "sign in with google" ||
      innerText === "signin with google" ||
      innerText === "signup with google" ||
      innerText === "sign up with google" ||
      innerText === "signup using google" ||
      innerText === "sign up using google" ||
      innerText === "google" ||
      button.ariaLabel?.toLowerCase().trim() === "continue with google" ||
      // Facebook
      innerText === "continue with facebook" ||
      innerText === "log in using facebook" ||
      innerText === "log in with facebook" ||
      innerText === "login with facebook" ||
      innerText === "sign in with facebook" ||
      innerText === "signin with facebook" ||
      innerText === "signup with facebook" ||
      innerText === "sign up with facebook" ||
      innerText === "signup using facebook" ||
      innerText === "sign up using facebook" ||
      innerText === "facebook" ||
      button.ariaLabel?.toLowerCase().trim() === "continue with facebook"
    );
  });

  returnElements = returnElements.concat(filteredBtns);

  const filteredIframes = iframes.filter((iframe) => {
    const title = iframe.title.toLowerCase().trim();
    const src = iframe.src.toLowerCase();
    return (
      // Apple
      title.includes("continue with apple") ||
      title.includes("log in using apple") ||
      title.includes("log in with apple") ||
      title.includes("login with apple") ||
      title.includes("sign in with apple") ||
      title.includes("signin with apple") ||
      // Google
      title.includes("continue with google") ||
      title.includes("log in using google") ||
      title.includes("log in with google") ||
      title.includes("login with google") ||
      title.includes("sign in with google") ||
      title.includes("signin with google") ||
      (src.includes("accounts.google.com") && src.includes("/gsi/button")) ||
      // Facebook
      title.includes("continue with facebook") ||
      title.includes("log in using facebook") ||
      title.includes("log in with facebook") ||
      title.includes("login with facebook") ||
      title.includes("sign in with facebook") ||
      title.includes("signin with facebook") ||
      (src.includes("facebook.com") && src.includes("login_button"))
    );
  });

  returnElements = returnElements.concat(filteredIframes);

  const filteredAnchors = anchors.filter((anchor) => {
    if (anchor.innerText) {
      const innerText = anchor.innerText.toLowerCase().trim();
      return (
        // Apple
        innerText === "continue with apple" ||
        innerText === "log in using apple" ||
        innerText === "log in with apple" ||
        innerText === "login with apple" ||
        innerText === "sign in with apple" ||
        innerText === "signin with apple" ||
        innerText === "signup with apple" ||
        innerText === "sign up with apple" ||
        innerText === "signup using apple" ||
        innerText === "sign up using apple" ||
        anchor.href.toLowerCase().includes("appleid.apple.com/auth/authorize") ||
        anchor.ariaLabel?.toLowerCase().trim() === "sign in with apple" ||
        // Google
        innerText === "continue with google" ||
        innerText === "log in using google" ||
        innerText === "log in with google" ||
        innerText === "login with google" ||
        innerText === "sign in with google" ||
        innerText === "signin with google" ||
        innerText === "signup with google" ||
        innerText === "sign up with google" ||
        innerText === "signup using google" ||
        innerText === "sign up using google" ||
        anchor.ariaLabel?.toLowerCase().trim() === "sign in with google" ||
        // Facebook
        innerText === "continue with facebook" ||
        innerText === "log in using facebook" ||
        innerText === "log in with facebook" ||
        innerText === "login with facebook" ||
        innerText === "sign in with facebook" ||
        innerText === "signin with facebook" ||
        innerText === "signup with facebook" ||
        innerText === "sign up with facebook" ||
        innerText === "signup using facebook" ||
        innerText === "sign up using facebook" ||
        anchor.href.toLowerCase().includes("/signin/facebook") ||
        anchor.ariaLabel?.toLowerCase().trim() === "sign in with facebook"
      );
    }
  });

  returnElements = returnElements.concat(filteredAnchors);

  const filteredDivs = divs.filter((div) => {
    const innerText = div.innerText.toLowerCase().trim();
    return (
      // Apple
      innerText === "continue with apple" ||
      innerText === "log in using apple" ||
      innerText === "log in with apple" ||
      innerText === "login with apple" ||
      innerText === "sign in with apple" ||
      innerText === "signin with apple" ||
      innerText === "signup with apple" ||
      innerText === "sign up with apple" ||
      innerText === "signup using apple" ||
      innerText === "sign up using apple" ||
      (div.getAttribute("role") === "button" && innerText === "sign up with apple") ||
      div.ariaLabel?.toLowerCase().trim() === "sign in with apple" ||
      // Google
      innerText === "continue with google" ||
      innerText === "log in using google" ||
      innerText === "log in with google" ||
      innerText === "login with google" ||
      innerText === "signup with google" ||
      innerText === "sign up with google" ||
      innerText === "signup using google" ||
      innerText === "sign up using google" ||
      // This prevents catching the sign in with google header
      (innerText === "sign in with google" && div.style.cursor === "pointer") ||
      innerText === "signin with google" ||
      div.id.toLowerCase().trim().includes("g-signin") ||
      // Facebook
      innerText === "continue with facebook" ||
      innerText === "log in using facebook" ||
      innerText === "log in with facebook" ||
      innerText === "login with facebook" ||
      innerText === "sign in with facebook" ||
      innerText === "signin with facebook" ||
      innerText === "signup with facebook" ||
      innerText === "sign up with facebook" ||
      innerText === "signup using facebook" ||
      innerText === "sign up using facebook"
    );
  });

  returnElements = returnElements.concat(filteredDivs);

  // Not worth getting all imgs and iterating over them.  Just add query selectors
  const appleImg: HTMLElement | null = document.querySelector('img[alt^="Sign in with"]');
  if (appleImg) {
    returnElements.push(appleImg);
  }

  return returnElements;
}

const getSavedSSOChoices = (extensionContext: ExtensionContext): SSODetails[] => {
  let existingSSOHolder: LoginItem | null = null;
  for (let i = 0; i < extensionContext.siteVaultItems.length; i++) {
    const vaultItem = extensionContext.siteVaultItems[i];
    if (vaultItem.ssoProvider && vaultItem.ssoProvider.length) {
      existingSSOHolder = vaultItem;
    }
  }
  if (existingSSOHolder) {
    return existingSSOHolder.ssoProvider;
  }
  return [];
};

const ssoButtonClicked = async (
  extensionContext: ExtensionContext,
  existingSSOChoices: SSODetails[],
  ssoProvider: SupportedSSOProviders,
) => {
  if (
    extensionContext &&
    extensionContext.magicLoginInitiated === false &&
    isDemoHost === false &&
    existingSSOChoices
      .map((choice) => {
        return choice.provider;
      })
      .indexOf(ssoProvider) === -1
  ) {
    hideMagicLoginModal(extensionContext);
    extensionContext.saveSSOShowing = true;
    extensionContext.saveSSOChoice = ssoProvider;
    extensionContext.saveLoginHostname = window.location.hostname;
    updateExtensionContext(extensionContext);
    startModalTimer(15_000, extensionContext);
    await showSaveLoginModal(extensionContext);
  }
};

const tellBGToHideOtherSaveSSOs = () => {
  chrome.runtime.sendMessage(
    messageToJSON({
      kind: "HIDE_OTHER_SAVE_SSO",
      currentLocation: window.location.toString(),
    }),
    function (r) {
      console.log(r);
    },
  );
};

chrome.runtime.onMessage.addListener((m) => {
  const message = messageFromJSON(m);

  // Ignore V2 messages
  if (message.kind.startsWith("v2")) {
    return;
  }

  // Recieve message about hiding existing sso modals
  switch (message.kind) {
    case "HIDE_SAVE_SSO":
      {
        const loc = message.payload;

        // The sender of this (tellBGToHideOtherSaveSSOs) specifies the location they are on
        // All other sso modals must hide
        if (loc !== window.location.toString()) {
          const host = document.getElementById("uno-save-container") as HTMLDivElement | null;
          if (host && extensionContext) {
            document.body.removeChild(host);
            if (modalTimer) {
              clearInterval(modalTimer);
            }
          }
        }
      }
      break;
    case "UPDATE_CONTENT_EXTENSION_CONTEXT":
      {
        extensionContext = message.extensionContext;
      }
      break;
    case "SHOW_AUTOFILL_MODAL":
      {
        extensionContext = message.payload;
        if (extensionContext) {
          showUnifiedAutofillModal(extensionContext);
        }
      }
      break;

    case "SHOW_FEEDBACK_FROM_POPUP":
      if (extensionContext) {
        showFeedbackModal(extensionContext);
      }
      break;

    default:
      break;
  }

  return true;
});

// Check if element or ancestors are display none
function isElementVisible(el: HTMLElement) {
  return !!el.offsetParent && el.ariaHidden !== "true";
}

window.addEventListener("beforeunload", function () {
  if (extensionContext && extensionContext.magicLoginShowing) {
    extensionContext.magicLoginShowing = false;
    updateExtensionContext(extensionContext);
  }
});

export const noOtherModalsShowing = () => {
  const suggestPWModal = document.getElementById("suggest-strong-password-container");

  const updateExistingLoginModal = document.getElementById("uno-update-login-container");

  const missingInfoModal = document.getElementById("missing-info-container");

  const duplicateFoundModal = document.getElementById("uno-duplicate-found-modal");

  const magicLoginModal = document.getElementById("uno-magic-modal");
  // For animations, ml modal isn't removed right away (it's removed on a set timeout)
  // Check for the class we add while it's being removed
  let mlModalBeingRemoved = false;
  if (magicLoginModal) {
    const shadow = magicLoginModal.shadowRoot;
    if (shadow) {
      const controller = shadow.getElementById("uno-modal-controller");
      if (controller && controller.classList.contains("modal-out")) {
        mlModalBeingRemoved = true;
      }
    }
  }

  const saveLoginModal = document.getElementById("uno-save-container");

  const mfaSavedModal = document.getElementById("uno-2fa-saved-host");

  const reconnectGoogleModal = document.getElementById("reconnect-gmail-modal");

  const saveCreditCardModal = document.getElementById("uno-save-credit-card-modal");

  const autofillCardModal = document.getElementById("uno-autofill-credit-cards-modal");

  const autofillAddressesModal = document.getElementById("uno-autofill-addresses-modal");

  let cmdMenuModal = document.getElementById("uno-command-menu-host");
  if (cmdMenuModal) {
    const controller = cmdMenuModal.shadowRoot?.getElementById("uno-modal-controller");
    if (controller) {
      if (controller.classList.contains("modal-out")) {
        cmdMenuModal = null;
      }
    }
  }

  const saveAddressModal = document.getElementById("uno-save-addresses-modal");

  // Not including these ones right now because of timing issues with removing the modal.  Doesn't really matter all too much
  // const mfaDetectedModal = document.getElementById("uno-2fa-detected-modal");
  // const override2faModal = document.getElementById("uno-override-2fa-host");

  if (
    !suggestPWModal &&
    !updateExistingLoginModal &&
    !missingInfoModal &&
    !duplicateFoundModal &&
    (!magicLoginModal || mlModalBeingRemoved) &&
    !saveLoginModal &&
    // !mfaDetectedModal &&
    // !override2faModal &&
    !mfaSavedModal &&
    !reconnectGoogleModal &&
    !saveCreditCardModal &&
    !autofillCardModal &&
    !autofillAddressesModal &&
    !saveAddressModal &&
    !cmdMenuModal
  ) {
    return true;
  }
  return false;
};

// TODO: MODAL ANIMATIONS for this
// SEE HIDE ML FOR EXAMPLE
export function closeAllOtherModals(extensionContext: ExtensionContext) {
  const autofillCardModal = document.getElementById("uno-autofill-credit-cards-modal");
  if (autofillCardModal) {
    document.body.removeChild(autofillCardModal);
  }

  const saveCardModal = document.getElementById("uno-save-credit-card-modal");
  if (saveCardModal) {
    document.body.removeChild(saveCardModal);
  }

  const suggestPWModal = document.getElementById("suggest-strong-password-container");
  if (suggestPWModal) {
    document.body.removeChild(suggestPWModal);
  }
  const updateExistingLoginModal = document.getElementById("uno-update-login-container");
  if (updateExistingLoginModal) {
    document.body.removeChild(updateExistingLoginModal);
  }
  const missingInfoModal = document.getElementById("missing-info-container");
  if (missingInfoModal) {
    document.body.removeChild(missingInfoModal);
  }
  const duplicateFoundModal = document.getElementById("uno-duplicate-found-modal");
  if (duplicateFoundModal) {
    document.body.removeChild(duplicateFoundModal);
  }
  const magicLoginModal = document.getElementById("uno-magic-modal");
  if (magicLoginModal) {
    document.body.removeChild(magicLoginModal);
    resetMagicLoginState(extensionContext);
  }
  const saveLoginModal = document.getElementById("uno-save-container");
  if (saveLoginModal) {
    document.body.removeChild(saveLoginModal);
  }

  const reconnectGoogleModal = document.getElementById("reconnect-gmail-modal");
  if (reconnectGoogleModal) {
    document.body.removeChild(reconnectGoogleModal);
  }
  const emailModal = document.getElementById("uno-gmail-container");
  if (emailModal) {
    document.body.removeChild(emailModal);
  }

  const feedbackModal = document.getElementById("uno-feedback-container");
  if (feedbackModal) {
    document.body.removeChild(feedbackModal);
  }

  const autofillAddModal = document.getElementById("uno-autofill-addresses-modal");
  if (autofillAddModal) {
    document.body.removeChild(autofillAddModal);
  }

  const unifiedAutofillModal = document.getElementById("uno-unified-autofill-modal");
  if (unifiedAutofillModal) {
    document.body.removeChild(unifiedAutofillModal);
  }
}

const meetsConfirmPWRules = (input: HTMLInputElement): boolean => {
  const html = input.outerHTML.toLowerCase();

  if (
    (html.includes("password_confirm") ||
      html.includes("confirmpassword") ||
      html.includes("confirm_password") ||
      html.includes("confirmed_password") ||
      html.includes("passwordverify") ||
      html.includes("confirmpasswd") ||
      html.includes("passwordconfirm") ||
      html.includes("confirm-password") ||
      input.placeholder.toLowerCase() === "confirm password" ||
      html.includes("passwordcheck")) &&
    isElementVisible(input)
  ) {
    return true;
  }
  return false;
};
const waitForModalStylesToLoad = (shadow: ShadowRoot, cb?: () => void) => {
  const modalStyles = shadow.getElementById("uno-modal-styles");
  if (modalStyles) {
    modalStyles.onload = () => {
      const modal = shadow.getElementById("uno-modal");
      if (modal) {
        modal.style.display = "flex";
        // The modal animation takes 200ms to fade-in
        setTimeout(() => {
          cb?.();
        }, 200);
      }
    };
  }
};

function getGmailToken(interactive = false) {
  chrome.runtime.sendMessage(
    messageToJSON({
      kind: "GET_AUTH_TOKEN",
      interactive,
    }),
    function (r) {
      try {
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "GOOGLE_TOKEN_RESP":
            extensionContext = message.payload;
            return;
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (e) {
        console.error("Error getting auth token", e);
      }
    },
  );
}

// grep: @OLD_COMMAND_MENU_FUNCTIONALITY
export async function callCmdFunction(extensionContext: ExtensionContext, id: string) {
  switch (id) {
    case cmdMenu.CMD_ID_FEEDBACK:
      await showFeedbackModal(extensionContext);
      createAnalyticsEvent(LegacyAnalyticsEvent.CmdMenuSendFeedbackOpened);
      break;

    case cmdMenu.CMD_ID_GMAIL_SCANNING:
      await showEmailModal(extensionContext);
      createAnalyticsEvent(LegacyAnalyticsEvent.CmdMenuPeakAtLastEmail);
      break;

    case cmdMenu.CMD_ID_INVITE_FRIEND:
      createAnalyticsEvent(LegacyAnalyticsEvent.CmdMenuInviteFriend);
      window.location =
        "mailto:?subject=Invite to Uno&body=Hey!%0D%0A%0D%0Acc'ing my friend who would love to try Uno.app. Can you add them?%0D%0A%0D%0AThanks!" as (
          | string
          | Location
        ) &
          Location;
      break;

    case cmdMenu.CMD_ID_SCAN_QR:
      await showScanningQRCodesModal();
      createAnalyticsEvent(LegacyAnalyticsEvent.CmdMenuScanQRCode);

      // MIKE; REFACTOR ME
      // TODO: REPLACE WITH CHRIS' REFACTORED QR CODE STUFF
      document.querySelectorAll("img").forEach(async (img) => {
        try {
          img.crossOrigin = "Anonymous";
          const codeReader = new BrowserQRCodeReader();
          const code = await codeReader.decodeFromImageElement(img);

          if (code.getRawBytes() && extensionContext) {
            const otpURL = parseURI(code.getText());
            if (otpURL && otpURL.query && otpURL.query.secret) {
              // We want to store the secret in the vault the following way:
              // - Decode the secret (it's base32 encoded when we get it)
              // - Base64 encode the raw bytes
              const decodedSecret = decodeString(otpURL.query.secret.toUpperCase());
              const b64encoded = uint8ArrayToBase64String(decodedSecret);
              // if (extensionContext.siteVaultItems.length) {
              // await show2FASavedModal(extensionContext, b64encoded);
              setTimeout(async () => {
                removeQRScanningModal();
                await show2FADetectedModal(extensionContext, b64encoded);
              }, 1000);

              // }
            }
          }
        } catch (error) {
          console.log(error);
        }
      });

      // Scan svgs
      document.querySelectorAll("svg").forEach(async (svg) => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const xml = new XMLSerializer().serializeToString(svg);
            const canv = await Canvg.from(ctx, xml);
            canv.start();

            const codeReader = new BrowserQRCodeReader();
            const code = codeReader.decodeFromCanvas(canvas);

            if (code.getRawBytes() && extensionContext) {
              const otpURL = parseURI(code.getText());
              if (otpURL && otpURL.query && otpURL.query.secret) {
                // We want to store the secret in the vault the following way:
                // - Decode the secret (it's base32 encoded when we get it)
                // - Base64 encode the raw bytes
                const decodedSecret = decodeString(otpURL.query.secret.toUpperCase());
                const b64encoded = uint8ArrayToBase64String(decodedSecret);
                if (extensionContext.siteVaultItems.length) {
                  removeQRScanningModal();
                  await show2FADetectedModal(extensionContext, b64encoded);
                }
              }
            }
          }
        } catch (error) {
          console.log(error);
        }
      });

      // Scan canvases
      document.querySelectorAll("canvas").forEach(async (canv) => {
        try {
          const codeReader = new BrowserQRCodeReader();
          const code = codeReader.decodeFromCanvas(canv);
          if (code.getRawBytes() && extensionContext) {
            const otpURL = parseURI(code.getText());
            if (otpURL && otpURL.query && otpURL.query.secret) {
              const decodedSecret = decodeString(otpURL.query.secret.toUpperCase());
              const b64encoded = uint8ArrayToBase64String(decodedSecret);
              if (extensionContext.siteVaultItems.length) {
                removeQRScanningModal();
                await show2FADetectedModal(extensionContext, b64encoded);
              }
            }
          }
        } catch (error) {
          console.log(error);
        }
      });

      setTimeout(() => {
        removeQRScanningModal();
        showNoQRCodesFoundModal();
      }, 3000);

      break;

    case cmdMenu.CMD_ID_SETUP_PEEKABOO:
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "GET_AUTH_TOKEN",
          interactive: true,
        }),
        function (r) {
          if (r == undefined) return;
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "GOOGLE_TOKEN_RESP":
              if (message && message.payload.gmailToken) {
                updateExtensionContext(message.payload);
              }
              break;
          }
        },
      );
      break;

    default:
      break;
  }
}

const cardExists = (extensionContext: ExtensionContext, cardNumber: string): boolean => {
  let isExistingCard = false;
  extensionContext.creditCards.forEach((card) => {
    if (card.number === cardNumber) {
      isExistingCard = true;
    }
  });
  return isExistingCard;
};

const addressExists = (extensionContext: ExtensionContext, address: string): boolean => {
  let isExistingAdd = false;
  extensionContext.addresses.forEach((add) => {
    if (add.line1 === address) {
      isExistingAdd = true;
    }
  });
  return isExistingAdd;
};

// Get the html to dynamically fill out a card for the autofill modal
const getCCAutoFillHTML = (cardName: string, lastFour: string, badgeType: string, cardIndex: number): string => {
  return `<!-- CC card item hovered -->
<div
  id="${cardName}"
  cardIndex=${cardIndex}
  class="autofillCC"
  style="
    /* Login Item */

    /* Auto layout */

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0px;
    gap: 8px;

    width: 228px;
    height: 48px;

    /* Inside auto layout */

    flex: none;
    order: 2;
    flex-grow: 0;
  "
>
  <!-- Badge & details -->
  <div
    class="autofillCCBig-badgeAndDetails"
    style="
      /* Auto layout */

      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 0px;
      gap: 16px;

      width: 189px;
      height: 26px;

      /* Inside auto layout */

      flex: none;
      order: 0;
      flex-grow: 0;
    "
  >
    <!-- Card badge -->
    <div class="autofillCCBig-badgeContainer" id="card-badge-container">
      ${getBadgeSVG(badgeType)}
    </div>
    <!-- Card name & number -->
    <div
      class="autofillCCBig-details"
      style="
        /* Auto layout */

        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0px;
        gap: 2px;

        width: 145px;
        height: 26px;

        /* Inside auto layout */

        flex: none;
        order: 1;
        flex-grow: 0;
      "
    >
      <!-- card name -->
      <span
        class="autofillCCBig-detailsName"
        style="
          width: 145px;
          height: 12px;

          font-weight: 510;
          font-size: 10px;
          line-height: 12px;
          /* identical to box height */

          color: #000000;

          /* Inside auto layout */

          flex: none;
          order: 0;
          flex-grow: 0;
        "
        >${cardName}</span
      >
      <!-- last 4 -->
      <span
        class="autofillCCBig-detailsLastFour"
        style="
          width: 25px;
          height: 12px;

          font-weight: 510;
          font-size: 10px;
          line-height: 12px;
          /* identical to box height */

          color: #989faa;

          /* Inside auto layout */

          flex: none;
          order: 1;
          flex-grow: 0;
        "
        >${lastFour}</span
      >
    </div>
  </div>
</div>`;
};

const getAddAutofillHTML = (address: string): string => {
  return `
  <div
  style="
    /* Login Item */

    /* Auto layout */

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0px;
    gap: 8px;

    width: 228px;
    height: 48px;

    /* Inside auto layout */

    flex: none;
    order: 0;
    flex-grow: 0;
  "
>
  <div
    style="
      /* Frame 1463 */

      /* Auto layout */

      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 0px;
      gap: 16px;

      width: 164px;
      height: 22px;

      /* Inside auto layout */

      flex: none;
      order: 0;
      flex-grow: 0;
    "
  >
    <!-- Pin -->
    <div
      style="
        /* Frame 1397 */

        /* Auto layout */

        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 4px 8px;
        gap: 8px;

        width: 28px;
        height: 22px;

        /* Inside auto layout */

        flex: none;
        order: 0;
        flex-grow: 0;
      "
    >
      <svg
        style="
          /* Group 1315 */

          width: 12px;
          height: 20px;

          /* Inside auto layout */

          flex: none;
          order: 0;
          flex-grow: 0;
        "
        width="12"
        height="20"
        viewBox="0 0 12 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5 5H7V19L6 20L5 19V5Z"
          fill="url(#paint0_linear_3931_66664)"
        />
        <path
          d="M5.25 5.25H6.75V18.8964L6 19.6464L5.25 18.8964V5.25Z"
          stroke="black"
          stroke-opacity="0.07"
          stroke-width="0.5"
        />
        <g filter="url(#filter0_ii_3931_66664)">
          <rect width="12" height="12" rx="6" fill="#FF0000" />
          <rect
            width="12"
            height="12"
            rx="6"
            fill="url(#paint1_linear_3931_66664)"
            fill-opacity="0.5"
          />
        </g>
        <defs>
          <filter
            id="filter0_ii_3931_66664"
            x="0"
            y="-0.5"
            width="12"
            height="13"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feGaussianBlur stdDeviation="0.5" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0"
            />
            <feBlend
              mode="normal"
              in2="shape"
              result="effect1_innerShadow_3931_66664"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="-0.5" />
            <feGaussianBlur stdDeviation="0.5" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
            />
            <feBlend
              mode="normal"
              in2="effect1_innerShadow_3931_66664"
              result="effect2_innerShadow_3931_66664"
            />
          </filter>
          <linearGradient
            id="paint0_linear_3931_66664"
            x1="6"
            y1="5"
            x2="6"
            y2="19"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#C1D5E9" />
            <stop offset="1" stop-color="#BDCAD9" />
          </linearGradient>
          <linearGradient
            id="paint1_linear_3931_66664"
            x1="6"
            y1="0"
            x2="6"
            y2="12"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="white" />
            <stop offset="1" stop-color="white" stop-opacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
    <!-- Address line 1 -->
    <div
      style="
        /* Frame 1465 */

        /* Auto layout */

        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0px;
        gap: 2px;

        width: 120px;
        height: 12px;

        /* Inside auto layout */

        flex: none;
        order: 1;
        flex-grow: 0;
      "
    >
      <span
        style="
          text-align: left;
          width: 120px;
          height: 12px;

          font-weight: 510;
          font-size: 10px;
          line-height: 12px;
          /* identical to box height */

          color: #000000;

          /* Inside auto layout */

          flex: none;
          order: 0;
          flex-grow: 0;
        "
      >${address}</span>
    </div>
  </div>
</div>
`;
};

function figureOutAutosaveModals(extensionContext: ExtensionContext) {
  // Check if card exists already
  let ccExists = false;
  if (haveCCInput && haveCCInput.value) {
    const formattedValue = onlyNumbers(haveCCInput.value);
    ccExists = cardExists(extensionContext, formattedValue);
  } else if (extensionContext.saveCCShowing === false && extensionContext.saveCCCardNumber) {
    const formattedValue = onlyNumbers(extensionContext.saveCCCardNumber);
    ccExists = cardExists(extensionContext, formattedValue);
  }

  let addExists = false;
  if (haveAddressInput && haveAddressInput.value) {
    addExists = addressExists(extensionContext, haveAddressInput.value);
  } else if (extensionContext.saveAddShowing && extensionContext.saveAddStreet) {
    addExists = addressExists(extensionContext, extensionContext.saveAddStreet);
  }

  // Only address
  if (
    haveAddressInput &&
    haveAddressInput.value &&
    addExists === false &&
    // We don't have a credit card input or we have one that doesn't have a value
    (haveCCInput === null || (haveCCInput && haveCCInput.value === "") || ccExists === true) &&
    // We don't have save cc data saved from an iframe
    (extensionContext.saveCCCardNumber === null || extensionContext.saveCCCardNumber === "")
  ) {
    showSaveAddressModal(extensionContext, inputsOfType, false, false);
    // Only Credit cards
  } else if (
    // We have a cc input with a value OR cc saved in context (from iframe)
    ((haveCCInput && haveCCInput.value) ||
      (extensionContext.saveCCCardNumber && extensionContext.saveCCShowing === false)) &&
    ccExists === false &&
    // and we don't have an address input
    (haveAddressInput === null || (haveAddressInput && haveAddressInput.value === "") || addExists === true)
  ) {
    const fromIframe = !!(extensionContext.saveCCCardNumber && extensionContext.saveCCShowing === false);

    showSaveCreditCardModal(extensionContext, false, inputsOfType, fromIframe);
    // Sequence modals
  } else if (
    ((haveCCInput && haveCCInput.value) ||
      (extensionContext.saveCCCardNumber && extensionContext.saveCCShowing === false)) &&
    ccExists === false &&
    haveAddressInput &&
    haveAddressInput.value &&
    addExists === false
  ) {
    const fromIframe = !!(extensionContext.saveCCCardNumber && extensionContext.saveCCShowing === false);

    // Be sure that the sequence happens if the page reloads
    extensionContext.saveAddShowing = true;
    updateExtensionContext(extensionContext);

    storeAddressDataInContext(extensionContext, inputsOfType);

    showSaveCreditCardModal(extensionContext, true, inputsOfType, fromIframe);
  }
}

function storeAddressDataInContext(extensionContext: ExtensionContext, inputsOfType: Array<InputWithType>) {
  inputsOfType.forEach((inputOfType) => {
    switch (inputOfType.type) {
      case INPUT_TYPE_STREET_ADDRESS:
        extensionContext.saveAddStreet = inputOfType.input.value;
        break;
      case INPUT_TYPE_ADDRESS_LINE_2:
        extensionContext.saveAddLine2 = inputOfType.input.value;
        break;
      case INPUT_TYPE_CITY:
        extensionContext.saveAddCity = inputOfType.input.value;
        break;
      case INPUT_TYPE_ZIP_CODE:
        extensionContext.saveAddZip = inputOfType.input.value;
        break;
      case INPUT_TYPE_STATE:
        extensionContext.saveAddState = inputOfType.input.value;
        break;
      case INPUT_TYPE_COUNTRY:
        extensionContext.saveAddCountry = inputOfType.input.value;
        break;
    }
  });
  updateExtensionContext(extensionContext);
}

function safariIze(elem: HTMLElement) {
  const ccc = elem.cloneNode(true);
  elem.replaceWith(ccc);
}

function showDemoSpotlight() {
  try {
    const spotlight = document.getElementById("uno-spotlight");
    if (spotlight) {
      spotlight.style.display = "block";
    }
  } catch (error) {
    console.log("error");
  }
}

export function hideDemoSpotlight() {
  try {
    const spotlight = document.getElementById("uno-spotlight");
    if (spotlight) {
      spotlight.style.display = "none";
    }
  } catch (error) {
    console.log("error");
  }
}

function uint8ArrayToBase64String(u8: Uint8Array) {
  return btoa(String.fromCharCode.apply(null, Array.from(u8)));
}

if (document.readyState === "complete") {
  // already fired, so run logic right away
  runWhenDocumentIsReady();
} else {
  // not fired yet, so let's listen for the event
  window.addEventListener("DOMContentLoaded", runWhenDocumentIsReady);
}
