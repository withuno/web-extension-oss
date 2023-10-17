import { truthyFilter } from "@/v2/types/type-guards";

import { FillableDataType } from "./autocomplete.types";
import { Zone, UnoOrchestrator } from "../../orchestrator";
import { GenerateOneTimeCodeFromSeed } from "../vault/generate-totp.action";
import { GetSiteItems } from "../vault/get-site-items.action";

export interface GetFillableVaultDataResult {
  rawData: string[];
  maskedData: string[];
}

export const GetFillableVaultData = UnoOrchestrator.registerAction({
  id: "autocomplete/get-fillable-vault-data",
  zone: Zone.Background,
  async execute(input: { fillableDataType: FillableDataType; url: string }): Promise<GetFillableVaultDataResult> {
    const { orchestrator, vaultService } = this.context;

    const siteItems = await orchestrator.useAction(GetSiteItems)(input.url);

    switch (input.fillableDataType) {
      case FillableDataType.MultiFactorCode: {
        const otpSeeds = siteItems?.items.map((item) => item.otpSeed).filter(truthyFilter) ?? [];
        const rawData = await Promise.all(
          otpSeeds.map(async (seed) => {
            return orchestrator.useAction(GenerateOneTimeCodeFromSeed)({ seed });
          }),
        );
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.Username: {
        const rawData = siteItems?.items.map((item) => item.username).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.Password: {
        const fillableItems = siteItems?.items.filter((item) => !!item.username && !!item.password);
        const rawData = fillableItems.map((item) => item.password).filter(truthyFilter) ?? [];
        const maskedData = fillableItems.map((item) => item.username).filter(truthyFilter) ?? [];
        return { rawData, maskedData };
      }

      case FillableDataType.Email: {
        const uniqueEmails = new Set<string>();
        const vault = await vaultService.getVault();
        vault.items
          .map((item) => item.username)
          .filter(truthyFilter)
          .forEach((username) => {
            uniqueEmails.add(username);
          });
        if (vault.email) {
          uniqueEmails.add(vault.email);
        }
        const rawData = Array.from(uniqueEmails);
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.CreditCardNumber: {
        const rawData = siteItems?.creditCards.map((cc) => cc.number).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.CreditCardExp: {
        const rawData = siteItems?.creditCards.map((cc) => cc.expiration).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.CreditCardCvc: {
        const rawData = siteItems?.creditCards.map((cc) => cc.cvv).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.PostalCode: {
        const rawData = siteItems?.addresses.map((add) => add.zip).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.Address: {
        const rawData = siteItems?.addresses.map((add) => add.line1).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.AddressLine2: {
        const rawData = siteItems?.addresses.map((add) => add.line2).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.City: {
        const rawData = siteItems?.addresses.map((add) => add.city).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.Country: {
        const rawData = siteItems?.addresses.map((add) => add.country).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.Name: {
        const rawData = siteItems?.creditCards.map((cc) => cc.holder).filter(truthyFilter) ?? [];
        return { rawData, maskedData: rawData };
      }

      case FillableDataType.State: // TODO: figure out how to support selects/dropdowns for state inputs
      case FillableDataType.Phone: // TODO: we don't support storing phone numbers (yet)
      case FillableDataType.Unknown:
      default:
        return { rawData: [], maskedData: [] };
    }
  },
});
