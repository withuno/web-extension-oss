import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

export enum HttpMethod {
  Get = "GET",
  Put = "PUT",
  Post = "POST",
}

export enum PopupActionState {
  Start,
  Requested,
  Succeeded,
  Failed,
}

export enum VerifiedStatus {
  Unknown,
  NotEmailed,
  EmailedNotVerified,
  Verified,
}

export enum EmailStatus {
  Unknown,
  NotVerified,
  Verified,
}

export type VaultItemId = string;

export type RelatedItem = {
  password?: string;
  otp?: string;
};

export enum ElementKind {
  Username,
  Password,
  MFA,
  Clickable,
  Submittable,
}

export enum MatchKind {
  QuerySelector,
  XPath,
}

export interface MatchingElement {
  target: Element;
  kind: ElementKind;
  sel?: any;
}

export type MatchSet = Set<MatchingElement>;

export type ElementAction = {
  kind: ActionKind;
  elementKind?: ElementKind;
  sel?: string;
  // TODO: add something to support xpath
};

export type ExtensionContext = {
  analyticsID: string | undefined;
  debugMode: boolean;
  email: string | undefined;
  currentLocation: Location | null;
  siteVaultItems: LoginItem[];
  addresses: Array<AddressItem>;
  creditCards: Array<CreditCardItem>;
  // Save login
  saveLoginShowing: boolean;
  saveLoginUsername: string | null;
  saveLoginPassword: string | null;
  saveLoginHostname: string | null; // because the save login modal can travel across navigations, it's really important that we capture the host name when the save login happens.  This prevents potentially saving information under the wrong hostname
  modalTickTime: number | null;
  // Save credit cards
  saveCCShowing: boolean;
  saveCCCardName: string | null;
  saveCCCardNumber: string | null;
  saveCCHolderName: string | null;
  saveCCCVC: string | null;
  saveCCExpiration: string | null;
  // Save addresses
  saveAddShowing: boolean;
  saveAddStreet: string | null;
  saveAddLine2: string | null;
  saveAddCity: string | null;
  saveAddState: string | null;
  saveAddZip: string | null;
  saveAddCountry: string | null;
  // Magic login
  magicLoginShowing: boolean;
  magicLoginInitiated: boolean;
  magicLoginAccountSelected: LoginItem | null;
  magicLoginSSOChoice: SupportedSSOProviders | null;
  userNameInputted: boolean;
  passwordInputted: boolean;
  submitButtonClicked: boolean;
  mfaCodeEntered: boolean;
  // AI Assist
  aiAssistShowing: boolean;
  aiAssistHeaderText: string;
  aiAssistTopic: string;
  aiAssistDomain: string | null;
  aiAssistInstructions: string | null;
  // Missing info
  missingInfoShowing: boolean;
  // Update login
  updateLoginShowing: boolean;
  // SSO Remembering
  saveSSOShowing: boolean;
  saveSSOChoice: SupportedSSOProviders | null;
  gmailToken: string | null;
  gmailScannerSetup: boolean;
  gmailIDsShown: string[];
  googleAuthError: boolean;
};

export enum ActionKind {
  None = "none",
  Fill = "fill",
  Click = "click",
  PressEnter = "press_enter",
  Exit = "exit",
  ExitFailure = "exit_failure",
}

export type Vault = Array<LoginItem>;

export type VaultSuccess = Array<VisibleVaultItem>;

export interface VaultSuccessEntryTemp extends Omit<LoginItem, "password" | "otpseed"> {
  hasPassword: boolean;
  hasOtpSeed: boolean;
}

// XXX: any
export type ServiceList = Array<any>;

export type SessionId = string;
export type SessionSeed = string;
export type Seed = string;

export type QrScannerResponse = {
  state: PopupActionState;
  result: null | string;
};

export type Message =
  | { kind: "GET_QR_SCANNER_STATE" }
  | { kind: "QR_SCANNER_STATE_RESPONSE"; payload: QrScannerResponse }
  | { kind: "INJECT_QR_SCANNER" }
  | { kind: "FOUND_QR"; payload: string }
  | { kind: "NO_QR_FOUND" }
  | { kind: "VAULT_ACTION_SUCCESS"; payload: VaultItem }
  | { kind: "GOOGLE_TOKEN_RESP"; payload: any }
  | { kind: "GET_SERVICE_LIST" }
  | { kind: "GET_SERVICE_LIST_SUCCESS"; payload: ServiceList }
  | { kind: "MATCH_TIMEOUT" }
  | { kind: "ERROR"; payload: UnoError }
  | { kind: "GET_VAULT_STARTED" }
  | { kind: "GET_VAULT_SUCCESS"; payload: VaultSuccess }
  | { kind: "GET_VAULT_RAW_SUCCESS"; payload: any }
  | { kind: "GET_VAULT_SUCCESS_OUT_OF_DATE"; payload: VaultSuccess }
  | { kind: "TRANSFER_SHARE"; payload: string }
  | { kind: "SESSION_RECOVERED" }
  | { kind: "SHOW_ONBOARD" }
  | {
      kind: "ANALYTICS_IDENTIFIERS_SUCCESS";
      payload: { uuid: string; email: string };
    }
  | { kind: "REMOVE_ACCOUNT" }
  | { kind: "SHARE_SEED" }
  | { kind: "START_SESSION" }
  | { kind: "SESSION_CREATED"; payload: SessionSeed }
  | { kind: "SESSION_RECOVERY_PENDING" }
  | { kind: "GET_AUTH_TOKEN"; interactive: boolean }
  | { kind: "GET_VAULT_ITEM"; payload: VaultItemId }
  | { kind: "GET_VAULT_ITEM_SUCCESS"; payload: VisibleVaultItem }
  | { kind: "GET_VAULT_ITEM_MFA"; payload: VaultItemId }
  | { kind: "GET_VAULT_ITEM_MFA_SUCCESS"; payload: string }
  | { kind: "GET_VAULT_USERNAME"; payload: string }
  | { kind: "GET_VAULT"; payload: boolean }
  | { kind: "GET_VAULT_RAW"; payload: boolean }
  | { kind: "GET_VAULT_EMAIL" }
  | { kind: "GET_VAULT_EMAIL_SUCCESS"; payload: string | undefined }
  | { kind: "GET_SESSION" }
  | { kind: "GET_SITE_ITEMS" }
  | { kind: "ACTIVE_SSO_SUCCESS"; payload: SSOFlow }
  | { kind: "ACTIVE_SSO_FAIL" }
  | { kind: "SITE_ITEMS_SUCCESS"; payload: any }
  | { kind: "SITE_ITEMS_SUCCESS_OUT_OF_DATE"; payload: any }
  | {
      kind: "GET_EXTENSION_CONTEXT";
      currentLocation: Location;
      updateVault: boolean;
    }
  | {
      kind: "GET_EXTENSION_CONTEXT_SUCCESS";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "UPDATE_CONTENT_EXTENSION_CONTEXT";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "UPDATE_EXTENSION_CONTEXT";
      extensionContext: ExtensionContext;
      tellContentScript?: boolean;
    }
  | {
      kind: "UPDATE_EXTENSION_CONTEXT_SUCCESS";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "SAVE_LOGIN";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "SAVE_LOGIN_SUCCESS";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "HIDE_SAVE_SSO";
      payload: string;
    }
  | {
      kind: "SAVE_SSO";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "SAVE_SSO_SUCCESS";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "HIDE_OTHER_SAVE_SSO";
      currentLocation: string;
    }
  | {
      kind: "SAVE_2FA_EXISTING_ACCOUNT";
      vaultItemID: VaultItemId;
      seed: string;
      currentLocation: Location;
    }
  | {
      kind: "SAVE_2FA_EXISTING_ACCOUNT_SUCCESS";
      extensionContext: ExtensionContext;
    }
  | {
      kind: "SAVE_2FA_EXISTING_ACCOUNT_FAIL";
    }
  | {
      kind: "UPDATE_VAULT_ITEM";
      payload: {
        schema_type: SchemaType;
        item: UpdateQuery;
      };
    }
  | {
      kind: "CREATE_VAULT_ITEM";
      payload: {
        schema_type: SchemaType;
        item: CreateQuery;
      };
    }
  | {
      kind: "DELETE_VAULT_ITEM";
      payload: VaultItemId;
    }
  | {
      kind: "TURN_OFF_GMAIL_SCANNER";
    }
  | {
      kind: "TURN_OFF_GMAIL_SCANNER_SUCCESS";
      payload: any;
    }
  | {
      kind: "NATIVE_BOOTSTRAP";
    }
  | {
      kind: "SAVE_CREDIT_CARD";
      creditCard: CreditCardItem;
    }
  | {
      kind: "SAVE_CREDIT_CARD_SUCCESS";
    }
  | {
      kind: "CREATE_VAULT";
      payload: string | null;
    }
  | {
      kind: "CREATE_VAULT_SUCCESS";
    }
  | {
      kind: "GET_EMAIL_STATUS";
      payload: string;
    }
  | {
      kind: "EMAIL_STATUS_SUCCESS";
      payload: EmailStatus;
    }
  | {
      kind: "GET_VERIFIED_STATUS";
    }
  | {
      kind: "VERIFIED_STATUS_SUCCESS";
      payload: VerifiedStatus;
    }
  | {
      kind: "START_EMAIL_VERIFY";
    }
  | {
      kind: "START_EMAIL_VERIFY_SUCCESS";
    }
  | {
      kind: "UPDATE_VAULT_EMAIL";
      payload: string;
    }
  | {
      kind: "UPDATE_VAULT_EMAIL_SUCCESS";
    }
  | {
      kind: "DO_CC_AUTOFILL_IN_IFRAME";
      payload: CreditCardItem;
    }
  | {
      kind: "SHOW_AUTOFILL_MODAL";
      payload: ExtensionContext;
    }
  | {
      kind: "SAVE_ADDRESS";
      address: AddressItem;
    }
  | {
      kind: "SAVE_ADDRESS_SUCCESS";
    }
  | { kind: "SHOW_FEEDBACK_FROM_POPUP" }
  | { kind: "CREATE_ANALYTICS_EVENT"; eventType: LegacyAnalyticsEvent }
  | {
      kind: "GET_AI_ASSIST_RESPONSE";
      topic: string;
      domain: string;
    }
  | {
      kind: "GET_AI_ASSIST_RESPONSE_SUCCESS";
      steps: string[];
      action_url: string;
    }
  | {
      kind: "GET_AI_ASSIST_RESPONSE_FAILURE";
    }
  | {
      kind: "GET_VAULT_INFO_FOR_INPUT_TYPE";
      inputType: InputType;
      currentLocation: Location;
    }
  | {
      kind: "GET_VAULT_INFO_FOR_INPUT_TYPE_RESPONSE";
      relevantVaultData: Array<string>;
    }
  | { kind: "NOOP" };

export type fireSaveLoginData = {
  username: string | null;
  password: string | null;
  url: string | null;
};

export interface Keys {
  pub: string;
  signing: string;
  vault: string;
}

export interface LoginItem {
  id: VaultItemId;
  url?: string;
  matching_hosts: Array<string>;
  name?: string;
  username?: string;
  password: string;
  otpSeed: string;
  notes: string;
  ssoProvider: Array<SSODetails>;
  relatedItems: Array<RelatedItem>;
  hasPassword: boolean | null;
  hasOtpSeed: boolean | null;
}

export interface CreditCardItem {
  id: VaultItemId;
  type: string | null;
  name: string | null;
  holder: string;
  number: string;
  expiration: string; // Numeric string like MMYY (i.e.: "0322")
  cvv: string | null;
  addressUUID: string | null;
}

export interface AddressItem {
  id: VaultItemId;
  line1: string;
  line2: string | null;
  city: string;
  zip: string;
  state: string;
  country: string;
}

export interface PrivateKeyItem {
  id: VaultItemId;
  key: string;
  password: string | null;
  walletAddresses: string[];
  name: string | null;
  notes: string | null;
  url: string;
}

export interface RefreshToken {
  id: VaultItemId;
  clientId: string;
  refreshToken: string;
}

export interface SecureNoteItem {
  id: VaultItemId;
  title: string;
  notes: string;
}

export interface VisibleVaultItemThemeData {
  logo_name?: string;
  brand_color?: string;
  fallback_img?: string;
  inset_x?: number;
  inset_y?: number;
}

export type VaultItem = LoginItem | CreditCardItem | AddressItem | PrivateKeyItem | RefreshToken | SecureNoteItem;

export type VisibleVaultItem =
  | (VisibleVaultItemThemeData & LoginItem & { schema_type: "login" })
  | (VisibleVaultItemThemeData & CreditCardItem & { schema_type: "credit_card" })
  | (VisibleVaultItemThemeData & AddressItem & { schema_type: "address" })
  | (VisibleVaultItemThemeData & PrivateKeyItem & { schema_type: "private_key" })
  | (VisibleVaultItemThemeData & SecureNoteItem & { schema_type: "secure_note" });

export type VisibleVaultItemBySchemaType<T extends SchemaType> = Extract<VisibleVaultItem, { schema_type: T }>;

export type SchemaType = VisibleVaultItem["schema_type"];

export type CreateQuery<Item extends VaultItem = VaultItem> = Omit<Item, "id">;
export type UpdateQuery<Item extends VaultItem = VaultItem> = Omit<
  { [P in keyof Item]?: Item[P] | null | undefined },
  "id"
> &
  Pick<Item, "id">;

export interface SSODetails {
  default: boolean;
  provider: SupportedSSOProviders;
  username: string;
}

export enum SupportedSSOProviders {
  Facebook = "facebook",
  Google = "google",
  Apple = "apple",
}

export interface SSOFlow {
  origin: string;
  vault_id: string | undefined;
  provider: string;
  confirmed: boolean;
}

export enum UnoError {
  None = 0,
  Parse = 1,
  SessionId, // 2
  BadResponse, // 3
  BadSessionShares, // 4
  BadSeed, // 5
  VaultNeedsSync, // 6
  NetworkError, // 7
  ShareDecryption, // 8
  MissingTOTP, // 9
  HostMismatch, // 10
  NeedsOnboard, // 11
  ClientOutOfDate, // 12
  NotFound, // 13
  Unknown, // 14
}

export type InputType =
  | "password"
  | "phone"
  | "email"
  | "credit-card"
  | "zip-code"
  | "cvc"
  | "address"
  | "address2"
  | "username"
  | "2fa"
  | "exp-date"
  | "city"
  | "state"
  | "country"
  | "name"
  | "general";

export function messageToJSON(message: Message): string {
  return JSON.stringify(message);
}

export function messageFromJSON(json: string): Message {
  let v: Message;

  try {
    v = JSON.parse(json);
  } catch (err) {
    throw new Error(`Error parsing JSON message: ${json}`);
  }

  switch (v.kind) {
    case "GET_EMAIL_STATUS":
    case "EMAIL_STATUS_SUCCESS":
    case "GET_QR_SCANNER_STATE":
    case "NO_QR_FOUND":
    case "INJECT_QR_SCANNER":
    case "SESSION_RECOVERED":
    case "SHOW_ONBOARD":
    case "ANALYTICS_IDENTIFIERS_SUCCESS":
    case "REMOVE_ACCOUNT":
    case "SHARE_SEED":
    case "START_SESSION":
    case "GET_SESSION":
    case "GET_VAULT_STARTED":
    case "SESSION_RECOVERY_PENDING":
    case "NOOP":
    case "GET_SERVICE_LIST":
    case "VAULT_ACTION_SUCCESS":
    case "ERROR":
    case "QR_SCANNER_STATE_RESPONSE":
    case "FOUND_QR":
    case "GET_VAULT_ITEM":
    case "GET_AUTH_TOKEN":
    case "GET_VAULT_ITEM_SUCCESS":
    case "GET_VAULT_ITEM_MFA":
    case "GET_VAULT_ITEM_MFA_SUCCESS":
    case "SESSION_CREATED":
    case "GOOGLE_TOKEN_RESP":
    case "GET_VAULT_RAW_SUCCESS":
    case "GET_VAULT_SUCCESS":
    case "GET_VAULT_SUCCESS_OUT_OF_DATE":
    case "GET_VAULT_RAW":
    case "GET_VAULT":
    case "GET_VAULT_EMAIL":
    case "GET_VAULT_EMAIL_SUCCESS":
    case "GET_SERVICE_LIST_SUCCESS":
    case "ACTIVE_SSO_SUCCESS":
    case "ACTIVE_SSO_FAIL":
    case "GET_SITE_ITEMS":
    case "SITE_ITEMS_SUCCESS":
    case "SITE_ITEMS_SUCCESS_OUT_OF_DATE":
    case "GET_VAULT_USERNAME":
    case "TRANSFER_SHARE":
    case "GET_EXTENSION_CONTEXT":
    case "GET_EXTENSION_CONTEXT_SUCCESS":
    case "UPDATE_EXTENSION_CONTEXT":
    case "UPDATE_EXTENSION_CONTEXT_SUCCESS":
    case "SAVE_LOGIN":
    case "SAVE_LOGIN_SUCCESS":
    case "SAVE_SSO":
    case "SAVE_SSO_SUCCESS":
    case "HIDE_OTHER_SAVE_SSO":
    case "SAVE_2FA_EXISTING_ACCOUNT":
    case "SAVE_2FA_EXISTING_ACCOUNT_SUCCESS":
    case "SAVE_2FA_EXISTING_ACCOUNT_FAIL":
    case "UPDATE_VAULT_ITEM":
    case "CREATE_VAULT_ITEM":
    case "DELETE_VAULT_ITEM":
    case "TURN_OFF_GMAIL_SCANNER":
    case "TURN_OFF_GMAIL_SCANNER_SUCCESS":
    case "CREATE_VAULT_SUCCESS":
    case "CREATE_VAULT":
    case "NATIVE_BOOTSTRAP":
    case "SAVE_CREDIT_CARD":
    case "SAVE_CREDIT_CARD_SUCCESS":
    case "GET_VERIFIED_STATUS":
    case "VERIFIED_STATUS_SUCCESS":
    case "START_EMAIL_VERIFY":
    case "START_EMAIL_VERIFY_SUCCESS":
    case "UPDATE_VAULT_EMAIL":
    case "UPDATE_VAULT_EMAIL_SUCCESS":
    case "DO_CC_AUTOFILL_IN_IFRAME":
    case "SHOW_AUTOFILL_MODAL":
    case "SAVE_ADDRESS":
    case "SAVE_ADDRESS_SUCCESS":
    case "SHOW_FEEDBACK_FROM_POPUP":
    case "CREATE_ANALYTICS_EVENT":
    case "GET_AI_ASSIST_RESPONSE":
    case "GET_AI_ASSIST_RESPONSE_SUCCESS":
    case "GET_AI_ASSIST_RESPONSE_FAILURE":
    case "GET_VAULT_INFO_FOR_INPUT_TYPE":
    case "GET_VAULT_INFO_FOR_INPUT_TYPE_RESPONSE":
    case "HIDE_SAVE_SSO":
      // validate
      return v;
  }

  // Consumers of `messageFromJSON` won't have a pathway to deal with this, but
  // we also don't want an incorrect error to raise here.
  if (v.kind.startsWith("v2")) {
    return v;
  }

  throw new Error(`Unexpected message kind ${JSON.stringify(JSON.parse(json))}`);
}
