import { LoginTarget } from "@withuno/locust";

import { UnoOrchestrator, Zone } from "@/v2/orchestrator";
import { truthyFilter } from "@/v2/types/type-guards";
import { generateCssSelector } from "@/v2/utils/css";
import { WebDriver } from "@/v2/utils/dom";

import { AutocompleteAttribute, FillableDataType, InputType } from "./autocomplete.types";
import { CreateAutocompleteChip } from "./create-autocomplete-chip.action";
import { GetFillableVaultData, GetFillableVaultDataResult } from "./get-fillable-vault-data.action";

export const InitializeAutocompleteController = UnoOrchestrator.registerAction({
  id: "autocomplete/initialize-controller",
  zone: Zone.Content,
  async execute(): Promise<void> {
    const { orchestrator } = this.context;

    document.addEventListener(
      "focus",
      (e) => {
        processInput(orchestrator, e.target);
      },
      true,
    );

    // Initialize as many autocomplete chips as we can immediately, then at
    // intervals of 2s until we've iterated 3 times. This should give the page
    // enough time to settle and fill out all possible autocomplete chips. We'll
    // catch any others we might have missed using the "focus" event listener
    // above.
    gatherAndProcessInputs(orchestrator).then(() => {
      setTimeout(() => {
        gatherAndProcessInputs(orchestrator);
      }, 2000);

      setTimeout(() => {
        gatherAndProcessInputs(orchestrator);
      }, 4000);

      setTimeout(() => {
        gatherAndProcessInputs(orchestrator);
      }, 6000);
    });
  },
});

function gatherAndProcessInputs(orchestrator: UnoOrchestrator) {
  const inputs = Array.from(document.querySelectorAll("input"));

  return Promise.all(
    inputs.map(async (input) => {
      return processInput(orchestrator, input);
    }),
  );
}

async function processInput(orchestrator: UnoOrchestrator, input: HTMLElement | EventTarget | null): Promise<void> {
  if (input && input instanceof HTMLInputElement && WebDriver.Field.isTextual(input)) {
    const fillableDataType = getFillableDataType(input);

    if (fillableDataType !== FillableDataType.Unknown) {
      if (!processInput.vaultDataMemo.has(fillableDataType)) {
        const relevantVaultData = await orchestrator.useAction(GetFillableVaultData)({
          url: window.location.toString(),
          fillableDataType,
        });
        processInput.vaultDataMemo.set(fillableDataType, relevantVaultData);
      }

      // We are intentionally not awaiting the following:
      orchestrator.useAction(CreateAutocompleteChip)({
        referenceElement: generateCssSelector(input),
        rawData: processInput.vaultDataMemo.get(fillableDataType)!.rawData,
        maskedData: processInput.vaultDataMemo.get(fillableDataType)!.maskedData,
        fillableDataType,
      });
    }
  }
}

processInput.vaultDataMemo = new Map<FillableDataType, GetFillableVaultDataResult>();

function getFillableDataType(input: HTMLInputElement): FillableDataType {
  const autocompleteAttr = (input.getAttribute("autocomplete")?.split(" ").filter(truthyFilter) ??
    []) as AutocompleteAttribute[];
  const typeAttr = input.getAttribute("type") as InputType;
  const nameAttr = input.getAttribute("name");
  const idAttr = input.getAttribute("id");

  const loginTarget = LoginTarget.find();
  const usernameField = loginTarget?.get("username");
  const passwordField = loginTarget?.get("password");
  const loginRelatedFillableDataType = (() => {
    switch (true) {
      case usernameField && input === usernameField:
      case nameAttr?.toLowerCase().includes("username"):
      case autocompleteAttr.includes("username"):
      case idAttr?.toLowerCase().includes("username"):
        return FillableDataType.Username;

      case passwordField && input === passwordField:
      case typeAttr === "password":
      case (typeAttr as string) === "current-password":
      case (typeAttr as string) === "new-password":
        return FillableDataType.Password;

      case autocompleteAttr.includes("one-time-code"):
      case (autocompleteAttr as string[]).includes("onetimecode"):
      case (autocompleteAttr as string[]).includes("one-time-password"):
      case (autocompleteAttr as string[]).includes("mfa-code"):
        return FillableDataType.MultiFactorCode;
    }
  })();

  // Browsers ignore `autocomplete="off"` for login forms.
  if (autocompleteAttr.includes("off")) {
    return loginRelatedFillableDataType ?? FillableDataType.Unknown;
  }

  switch (true) {
    case autocompleteAttr.includes("email"):
    case typeAttr === "email":
    case nameAttr?.toLowerCase().includes("email"):
    case idAttr?.toLowerCase().includes("email"):
    case input.hasAttribute("data-automation-id"):
      return FillableDataType.Email;

    // This case is intentionally placed after "Email" because we'd rather
    // "Email" take precedence over "Username". Sometimes `@withuno/locust` will
    // interpret email fields as the username input of a `LoginTarget`, so we
    // don't want to accidentally autofill an email input with malformed data.
    case loginRelatedFillableDataType != null:
      return loginRelatedFillableDataType!;

    case autocompleteAttr.includes("name"):
      return FillableDataType.Name;

    case autocompleteAttr.includes("address-line2"):
    case (autocompleteAttr as string[]).includes("addressline2"):
      return FillableDataType.AddressLine2;

    case autocompleteAttr.includes("address-level1"):
    case (autocompleteAttr as string[]).includes("addresslevel1"):
      return FillableDataType.State;

    case autocompleteAttr.includes("address-level2"):
    case (autocompleteAttr as string[]).includes("addresslevel2"):
      return FillableDataType.City;

    case autocompleteAttr.includes("postal-code"):
    case (autocompleteAttr as string[]).includes("postalcode"):
    case nameAttr?.toLowerCase().includes("zip"):
    case idAttr?.toLowerCase().includes("zip"):
      return FillableDataType.PostalCode;

    case autocompleteAttr.includes("street-address"):
    case (autocompleteAttr as string[]).includes("streetaddress"):
    case autocompleteAttr.includes("address-line1"):
    case (autocompleteAttr as string[]).includes("addressline1"):
    case nameAttr?.toLowerCase().includes("address"):
    case idAttr?.toLowerCase().includes("address"):
      return FillableDataType.Address;

    case autocompleteAttr.includes("country"):
      return FillableDataType.Country;

    case autocompleteAttr.includes("tel"):
    case typeAttr === "tel":
    case (typeAttr as string) === "phone":
      return FillableDataType.Phone;

    case autocompleteAttr.includes("cc-exp"):
    case (autocompleteAttr as string[]).includes("ccexp"):
      return FillableDataType.CreditCardExp;

    case autocompleteAttr.includes("cc-csc"):
    case (autocompleteAttr as string[]).includes("cccsc"):
    case nameAttr?.toLowerCase().includes("cvc"):
    case idAttr?.toLowerCase().includes("cvc"):
      return FillableDataType.CreditCardCvc;

    case autocompleteAttr.includes("cc-name"):
    case (autocompleteAttr as string[]).includes("ccname"):
      return FillableDataType.Name;

    case autocompleteAttr.includes("cc-number"):
    case (autocompleteAttr as string[]).includes("ccnumber"):
    case nameAttr?.toLowerCase().includes("card"):
    case idAttr?.toLowerCase().includes("card"):
      return FillableDataType.CreditCardNumber;

    default:
      return FillableDataType.Unknown;
  }
}
