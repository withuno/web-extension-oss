import creditCardType from "credit-card-type";

import {
  doAutofillForCard,
  findInputsOfType,
  INPUT_TYPE_CREDIT_CARD_CVC,
  INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE,
  INPUT_TYPE_CREDIT_CARD_HOLDER_NAME,
  INPUT_TYPE_CREDIT_CARD_NUMBER,
  onlyNumbers,
  generateCardName,
} from "./autocomplete";
import { messageToJSON, messageFromJSON, ExtensionContext } from "../uno_types";

let extensionContext: ExtensionContext | null = null;
let calledShowAutofillModal = false;

if (inIframe()) {
  // Only run the loop if the tab is active
  if (document.visibilityState === "visible") {
    // Listener for messages
    chrome.runtime.onMessage.addListener((message) => {
      // Recieve message about hiding existing sso modals
      switch (message.action) {
        case "DO_CC_AUTOFILL_IN_IFRAME":
          {
            if (extensionContext) {
              const { creditCard } = message;
              const inputs: HTMLInputElement[] = Array.prototype.slice.call(document.querySelectorAll("input"));
              const selects: HTMLSelectElement[] = Array.prototype.slice.call(document.querySelectorAll("select"));
              const inputsOfType = findInputsOfType(extensionContext, inputs, selects);

              doAutofillForCard(inputsOfType, creditCard);
            }
          }
          break;

        default:
          break;
      }
    });

    // TODO: Change this to a mutation observer and run the document scanner once at page load (because mutationObserver mounts too late)
    // Loop to check for stuff
    setInterval(() => {
      chrome.runtime.sendMessage(
        messageToJSON({
          kind: "GET_EXTENSION_CONTEXT",
          currentLocation: window.location,
          updateVault: false,
        }),
        async function (r) {
          try {
            const message = messageFromJSON(r);
            switch (message.kind) {
              case "GET_EXTENSION_CONTEXT_SUCCESS":
                {
                  extensionContext = message.extensionContext;
                  if (extensionContext && document.visibilityState === "visible") {
                    const inputs: HTMLInputElement[] = Array.prototype.slice.call(document.querySelectorAll("input"));
                    const selects: HTMLSelectElement[] = Array.prototype.slice.call(
                      document.querySelectorAll("select"),
                    );
                    const inputsOfType = findInputsOfType(extensionContext, inputs, selects);
                    if (inputsOfType.length) {
                      let updates = false;
                      let ccDataInIframe = false;

                      inputsOfType.forEach((inputOfType) => {
                        // Get the data from whichever fields are here
                        switch (inputOfType.type) {
                          case INPUT_TYPE_CREDIT_CARD_NUMBER:
                            ccDataInIframe = true;
                            const creditCardNumber = onlyNumbers(inputOfType.input.value);

                            // regex to match 16 numbers
                            const ccNumberRegex = new RegExp("^[0-9]{16}$");
                            // TODO; what should do we do if not properly formatted?
                            if (
                              extensionContext &&
                              ccNumberRegex.test(creditCardNumber) === true &&
                              creditCardNumber !== extensionContext.saveCCCardNumber
                            ) {
                              extensionContext.saveCCCardNumber = creditCardNumber;

                              const ccTypeInfo = creditCardType(creditCardNumber);

                              const cardName = generateCardName(creditCardNumber, ccTypeInfo);
                              extensionContext.saveCCCardName = cardName;
                              updates = true;
                            }
                            break;
                          case INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE:
                            ccDataInIframe = true;
                            if (
                              extensionContext &&
                              inputOfType.input.value &&
                              inputOfType.input.value !== extensionContext.saveCCExpiration
                            ) {
                              extensionContext.saveCCExpiration = inputOfType.input.value;
                              updates = true;
                            }
                            break;
                          case INPUT_TYPE_CREDIT_CARD_CVC:
                            ccDataInIframe = true;
                            if (
                              extensionContext &&
                              inputOfType.input.value &&
                              inputOfType.input.value !== extensionContext.saveCCCVC
                            ) {
                              extensionContext.saveCCCVC = inputOfType.input.value;
                              updates = true;
                            }
                            break;
                          case INPUT_TYPE_CREDIT_CARD_HOLDER_NAME:
                            ccDataInIframe = true;
                            if (
                              extensionContext &&
                              inputOfType.input.value &&
                              inputOfType.input.value !== extensionContext.saveCCHolderName
                            ) {
                              extensionContext.saveCCHolderName = inputOfType.input.value;
                              updates = true;
                            }
                            break;
                        }
                      });
                      if (updates) {
                        chrome.runtime.sendMessage(
                          messageToJSON({
                            kind: "UPDATE_EXTENSION_CONTEXT",
                            extensionContext,
                            tellContentScript: true,
                          }),
                        );
                      }

                      // Is there CC data in this iframe?
                      if (extensionContext && ccDataInIframe && calledShowAutofillModal === false) {
                        calledShowAutofillModal = true;
                        chrome.runtime.sendMessage(
                          messageToJSON({
                            kind: "SHOW_AUTOFILL_MODAL",
                            payload: extensionContext,
                          }),
                        );
                      }
                    }
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
    }, 1000);
  }
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}
