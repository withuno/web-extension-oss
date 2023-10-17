import { CreditCardType } from "credit-card-type/dist/types";

import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

import { reactStyleFill } from "../dom";
import { ExtensionContext, CreditCardItem, AddressItem } from "../uno_types";
import { createAnalyticsEvent } from "../utils";

export type InputWithType = {
  input: HTMLInputElement | HTMLSelectElement;
  type: number;
};

// For more on these:
// https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#values
export const INPUT_TYPE_NONE = 0;
export const INPUT_TYPE_FIRST_NAME = 1;
export const INPUT_TYPE_LAST_NAME = 2;
export const INPUT_TYPE_FULL_NAME = 3;
export const INPUT_TYPE_STREET_ADDRESS = 4;
export const INPUT_TYPE_CITY = 5;
export const INPUT_TYPE_STATE = 6;
export const INPUT_TYPE_ZIP_CODE = 7;
export const INPUT_TYPE_TELEPHONE_FULL = 8;
export const INPUT_TYPE_EMAIL = 9;
export const INPUT_TYPE_COUNTRY = 10;
export const INPUT_TYPE_CREDIT_CARD_NUMBER = 11;
export const INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE = 12;
export const INPUT_TYPE_CREDIT_CARD_CVC = 13;
export const INPUT_TYPE_CREDIT_CARD_HOLDER_NAME = 14;
export const INPUT_TYPE_ADDRESS_LINE_2 = 15;
export const INPUT_TYPE_UNKNOWN = -1;
export const INPUT_TYPE_OFF = -2;

export function mapInputAutocompleteToType(autocomplete: string): number {
  if (autocomplete.split(" ").includes("name")) {
    return INPUT_TYPE_FULL_NAME;
  }
  if (autocomplete.split(" ").includes("given-name")) {
    return INPUT_TYPE_FIRST_NAME;
  }
  if (autocomplete.split(" ").includes("family-name")) {
    return INPUT_TYPE_LAST_NAME;
  }
  if (autocomplete.split(" ").includes("street-address")) {
    return INPUT_TYPE_STREET_ADDRESS;
  }
  if (autocomplete.split(" ").includes("address-line1")) {
    return INPUT_TYPE_STREET_ADDRESS;
  }
  if (autocomplete.split(" ").includes("address-line2")) {
    return INPUT_TYPE_ADDRESS_LINE_2;
  }
  if (autocomplete.split(" ").includes("address-level2")) {
    return INPUT_TYPE_CITY;
  }
  if (autocomplete.split(" ").includes("address-level1")) {
    return INPUT_TYPE_STATE;
  }
  if (autocomplete.split(" ").includes("postal-code")) {
    return INPUT_TYPE_ZIP_CODE;
  }
  if (autocomplete.split(" ").includes("tel")) {
    return INPUT_TYPE_TELEPHONE_FULL;
  }
  if (autocomplete.split(" ").includes("email")) {
    return INPUT_TYPE_EMAIL;
  }
  if (autocomplete.split(" ").includes("country")) {
    return INPUT_TYPE_COUNTRY;
  }
  if (autocomplete.split(" ").includes("cc-number")) {
    return INPUT_TYPE_CREDIT_CARD_NUMBER;
  }
  if (autocomplete.split(" ").includes("cc-exp")) {
    return INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE;
  }
  if (autocomplete.split(" ").includes("cc-csc")) {
    return INPUT_TYPE_CREDIT_CARD_CVC;
  }
  if (autocomplete.split(" ").includes("ccname")) {
    return INPUT_TYPE_CREDIT_CARD_HOLDER_NAME;
  }
  if (autocomplete.split(" ").includes("cc-name")) {
    return INPUT_TYPE_CREDIT_CARD_HOLDER_NAME;
  }
  if (autocomplete.split(" ").includes("none")) {
    return INPUT_TYPE_NONE;
  }
  if (autocomplete.split(" ").includes("off")) {
    return INPUT_TYPE_OFF;
  }

  return INPUT_TYPE_UNKNOWN;
}

export function findInputsOfType(
  extensionContext: ExtensionContext,
  inputs: HTMLInputElement[],
  selects: HTMLSelectElement[],
): Array<InputWithType> {
  const inputsOfInterest: Array<InputWithType> = [];
  const inpAndSelects: Array<HTMLInputElement | HTMLSelectElement> = [...inputs, ...selects];
  inpAndSelects.forEach((input) => {
    if (isHidden(input) === false && isOffscreen(input) === false) {
      const autocomplete = input.getAttribute("autocomplete");
      if (autocomplete) {
        const elementType = mapInputAutocompleteToType(autocomplete);
        if (elementType > 0) {
          switch (elementType) {
            case INPUT_TYPE_FIRST_NAME:
              if (extensionContext.debugMode) {
                input.style.outline = "orange solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_FIRST_NAME,
              });
              break;
            case INPUT_TYPE_LAST_NAME:
              if (extensionContext.debugMode) {
                input.style.outline = "green solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_LAST_NAME,
              });
              break;
            case INPUT_TYPE_FULL_NAME:
              if (extensionContext.debugMode) {
                input.style.outline = "purple solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_FULL_NAME,
              });
              break;
            case INPUT_TYPE_STREET_ADDRESS:
              if (extensionContext.debugMode) {
                input.style.outline = "gray solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_STREET_ADDRESS,
              });
              break;
            case INPUT_TYPE_ADDRESS_LINE_2:
              if (extensionContext.debugMode) {
                input.style.outline = "gray solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_ADDRESS_LINE_2,
              });
              break;
            case INPUT_TYPE_CITY:
              if (extensionContext.debugMode) {
                input.style.outline = "maroon solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_CITY,
              });
              break;
            case INPUT_TYPE_STATE:
              if (extensionContext.debugMode) {
                input.style.outline = "teal solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_STATE,
              });
              break;
            case INPUT_TYPE_ZIP_CODE:
              if (extensionContext.debugMode) {
                input.style.outline = "blue solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_ZIP_CODE,
              });
              break;
            case INPUT_TYPE_TELEPHONE_FULL:
              if (extensionContext.debugMode) {
                input.style.outline = "cyan solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_TELEPHONE_FULL,
              });
              break;
            case INPUT_TYPE_EMAIL:
              if (extensionContext.debugMode) {
                input.style.outline = "chocolate solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_EMAIL,
              });
              break;
            case INPUT_TYPE_COUNTRY:
              if (extensionContext.debugMode) {
                input.style.outline = "pink solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_COUNTRY,
              });
              break;
            case INPUT_TYPE_CREDIT_CARD_NUMBER:
              if (extensionContext.debugMode) {
                input.style.outline = "lawngreen solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_CREDIT_CARD_NUMBER,
              });
              break;
            case INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE:
              if (extensionContext.debugMode) {
                input.style.outline = "crimson solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE,
              });
              break;
            case INPUT_TYPE_CREDIT_CARD_CVC:
              if (extensionContext.debugMode) {
                input.style.outline = "powderblue solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_CREDIT_CARD_CVC,
              });
              break;
            case INPUT_TYPE_CREDIT_CARD_HOLDER_NAME:
              if (extensionContext.debugMode) {
                input.style.outline = "blueviolet solid 3px";
              }
              inputsOfInterest.push({
                input,
                type: INPUT_TYPE_CREDIT_CARD_HOLDER_NAME,
              });
              break;
            case INPUT_TYPE_NONE:
              if (extensionContext.debugMode) {
                input.style.outline = "red dashed 5px";
              }
              break;

            default:
              break;
          }
        }
      }
    }
  });
  return inputsOfInterest;
}

export const onlyNumbers = (inText: string): string => {
  return inText.replace(/[^\d]/g, "");
};

export const doAutofillForCard = (inputsOfType: Array<InputWithType>, vaultCard: CreditCardItem) => {
  inputsOfType.forEach((inputOfType) => {
    switch (inputOfType.type) {
      case INPUT_TYPE_CREDIT_CARD_NUMBER:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultCard.number);
        break;
      case INPUT_TYPE_CREDIT_CARD_EXPIRATION_DATE:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultCard.expiration);
        break;
      case INPUT_TYPE_CREDIT_CARD_CVC:
        if (vaultCard.cvv) {
          reactStyleFill(inputOfType.input as HTMLInputElement, vaultCard.cvv);
        }
        break;
      case INPUT_TYPE_CREDIT_CARD_HOLDER_NAME:
        if (vaultCard.holder) {
          reactStyleFill(inputOfType.input as HTMLInputElement, vaultCard.holder);
        }
        break;
    }
  });

  createAnalyticsEvent(LegacyAnalyticsEvent.CreditCardAutofilled);
};

export const doAutofillForAddress = (inputsOfType: Array<InputWithType>, vaultAdd: AddressItem) => {
  inputsOfType.forEach((inputOfType) => {
    switch (inputOfType.type) {
      case INPUT_TYPE_STREET_ADDRESS:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultAdd.line1);
        break;
      case INPUT_TYPE_ADDRESS_LINE_2:
        if (vaultAdd.line2) {
          reactStyleFill(inputOfType.input as HTMLInputElement, vaultAdd.line2);
        }
        break;
      case INPUT_TYPE_CITY:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultAdd.city);
        break;
      case INPUT_TYPE_COUNTRY:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultAdd.country);
        break;
      case INPUT_TYPE_STATE:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultAdd.state);
        break;
      case INPUT_TYPE_ZIP_CODE:
        reactStyleFill(inputOfType.input as HTMLInputElement, vaultAdd.zip);
        break;
    }
  });

  createAnalyticsEvent(LegacyAnalyticsEvent.AddressAutofilled);
};

export const generateCardName = (cardNumber: string, typeInfo: CreditCardType[]): string => {
  let cardName = "Unnamed card";
  if (typeInfo.length) {
    cardName = `${`${typeInfo[0].niceType} ${cardNumber.slice(-4)}`}`;
  } else {
    cardName = `${`Card ${cardNumber.slice(-4)}`}`;
  }

  return cardName;
};

const isHidden = (el: any) => {
  const rect = el.getBoundingClientRect();
  if (rect.width == 0 && rect.height == 0) {
    return true;
  }

  const s = window.getComputedStyle(el);

  return s.display == "none" || s.visibility == "hidden" || Number(s.opacity) == 0 || isOffscreen(el);
};

const isOffscreen = (el: any) => {
  const rect = el.getBoundingClientRect();
  return (
    rect.x < 0 || rect.y < 0 || rect.x + rect.width > window.innerWidth || rect.y + rect.height > window.innerHeight
  );
};
