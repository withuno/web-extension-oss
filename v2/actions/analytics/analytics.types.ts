export namespace AnalyticsEvent {
  /**
   * An object containing information about application-level analytics events for
   * dispatch to our analytics provider: Segment.
   */
  export interface Type<EventProperties = any> {
    type: string;
    properties?: EventProperties;
  }

  /**
   * A factory-function which creates an `AnalyticsEvent`-shaped object. The
   * factory accepts additional, strongly-typed `EventParameters` which will be
   * attached to the underlying Segment event.
   */
  export interface Factory<EventProperties = void> {
    (
      ...args: EventProperties extends void ? [] : [properties: EventProperties]
    ): EventProperties extends void ? Type<Record<string, never>> : Type<EventProperties>;
  }

  /**
   * @returns a strongly-typed `AnalyticsEvent` factory.
   */
  export function define<EventProperties = void>(type: string): Factory<EventProperties> {
    return (...args) => ({ type, properties: args[0] }) as any;
  }
}

export enum LegacyAnalyticsEvent {
  // Miscellaneous V1 modals...
  AddressSaved = "Address saved",
  AddressSaveDisplayed = "Save address displayed",
  AddressAutofilled = "Address autofilled",
  CreditCardSaved = "Credit card saved",
  CreditCardSaveModalDisplayed = "Saved credit card modal displayed",
  CreditCardAutofilled = "Credit card autofilled",
  CreditCardAutofillDisplayed = "Credit card autofill modal displayed",
  EmailScannerAutoShowModal = "Email scanner auto show modal",
  EmailScannerReconnect = "Email scanner reconnect modal displayed",
  ExtensionInstalled = "Extension Installed",
  ExtensionUninstalled = "Extension Uninstalled",
  FeedbackSubmitted = "Feedback Submitted",
  FoundBadSSOVaultItem = "Found Bad SSO Vault Item",
  GmailScan403 = "403 While Scanning Gmail",
  SaveLoginModalDisplayed = "Save Login Modal Displayed",
  SaveLoginSaved = "Saved Login",
  SaveLoginCancelled = "Save Login Canceled",
  SaveLoginMissingInfo = "Save login missing info modal showed",
  SaveLoginDuplicateFound = "Save login duplicate found modal showed",
  SaveLoginUpdateExistingAccount = "Save login update existing account",
  SuggestStrongPasswordDisplayed = "Suggest strong password displayed",
  StrongPasswordGenerated = "Strong password generated",
  UnoLogoInjected = "Uno logo injected",
  UnoInjectedLogoClicked = "Uno injected logo clicked",
  QRCodeDetectedAutoDisplayed = "QR code detected modal automatically displayed",
  QRCodeSaved = "QR code saved to account",
  QRCodeOverrideCurrent2fa = "QR code override current 2fa modal displayed",

  // Command Menu
  CmdMenuOpened = "Command Menu Opened",
  CmdMenuCopyUsername = "Command Menu Copy Username",
  CmdMenuCopyPassword = "Command Menu Copy Password",
  CmdMenuCopy2FA = "Command Menu Copy 2fa",
  CmdMenuCopyCardNumber = "Command menu copy credit card number",
  CmdMenuCopyCardHolderName = "Command menu copy credit card holder name",
  CmdMenuCopyCardExpiration = "Command menu copy credit card expiration",
  CmdMenuCopyCardCVV = "Command menu copy credit card CVV",
  CmdMenuGenerateStrongPasswordOpened = "Command Menu Generate Strong Password Opened",
  CmdMenuPeakAtLastEmail = "Command Menu Peak at Last Email",
  CmdMenuScanQRCode = "Command Menu Scan QR code",
  CmdMenuScanQRCodeNoneFound = "Command Menu Scan QR code none found",
  CmdMenuSendFeedbackOpened = "Command Menu Send Feedback Opened",
  CmdMenuInviteFriend = "Command Menu Invite Friend",
  CmdMenuAiAssistResetPassword = "Command Menu AI Assist for topic: reset-password",
  CmdMenuAiAssistSetup2fa = "Command Menu AI Assist for topic: enable-2fa",

  // Demo ("Aquarium")
  DemoPasswordAutofilled = "Demo Password Autofilled",
  DemoLoginSaved = "Demo Login Saved",
  Demo2faAdded = "Demo 2fa Added",
  DemoVerificationCodeCopied = "Demo Verification Code Copied",
  DemoCmdCarousel = "Demo Command Menu Carousel Step",
  DemoPeekabooCarousel = "Demo peekaboo carousel step",
  DemoIOSCarousel = "Demo get uno ios carousel step",
  DemoIOSSignInCarousel = "Demo sign into uno carousel step",
  DemoReadyToGo = "Demo ready to go import passwords step",

  // Popup
  UnifiedAutofillDisplayed = "Unified autofill modal displayed",
  UsernameCopied = "Username Copied",
  PasswordCopied = "Password Copied",
  VaultItemCopied = "Vault Item Copied",
  MFACopied = "MFA Copied",
  CreditCardNumberCopied = "Credit card number copied",
  CreditCardExpirationCopied = "Credit card expiration copied",
  CreditCardCvvCopied = "Credit card CVV copied",
  AddressLine1Copied = "Address line 1 copied",
  AddressLine2Copied = "Address line 2 copied",
  AddressCityCopied = "Address city copied",
  AddressStateCopied = "Address state copied",
  AddressZipCopied = "Address ZIP code copied",
  AddressCountryCopied = "Address country copied",
  PrivateKeyCopied = "Private key copied",
  PrivateKeyPasswordCopied = "Private key password copied",
  PrivateKeyAddressCopied = "Private key address copied",
  SecureNotesCopied = "Secure notes copied",

  // Vault service
  CreateLoginItem = "Create Vault Item: login",
  CreateCreditCardItem = "Create Vault Item: credit card",
  CreateAddressItem = "Create Vault Item: address",
  CreatePrivateKeyItem = "Create Vault Item: private key",
  CreateSecureNoteItem = "Create Vault Item: secure note",
  UpdateLoginItem = "Update Vault Item: login",
  UpdateCreditCardItem = "Update Vault Item: credit card",
  UpdateAddressItem = "Update Vault Item: address",
  UpdatePrivateKeyItem = "Update Vault Item: private key",
  UpdateSecureNoteItem = "Update Vault Item: secure note",
  DeleteLoginItem = "Delete Vault Item: login",
  DeleteCreditCardItem = "Delete Vault Item: credit card",
  DeleteAddressItem = "Delete Vault Item: address",
  DeletePrivateKeyItem = "Delete Vault Item: private key",
  DeleteSecureNoteItem = "Delete Vault Item: secure note",
  WriteVaultFailure = "Writing vault data failure",
  SchemaValidationFailure = "Schema validation failure",

  // Onboarding
  OnboardSignUpSubmit = "Onboard Sign Up Submit",
  OnboardSignUpAlreadyExists = "Onboard Sign Up Already Exists",
  OnboardSignInPrivateKey = "Onboard Sign In Private Key",
  OnboardSignInQR = "Onboard Sign In QR",

  // AI Assist V1 ("help topics")
  AiAssistResetPasswordPromptInitiated = `AI Assist prompt initiated for topic: reset-password`,
  AiAssistSetup2faPromptInitiated = `AI Assist prompt initiated for topic: enable-2fa`,
  AiAssistResetPasswordModalDismissed = `AI Assist modal dismissed for topic: reset-password`,
  AiAssistSetup2faModalDismissed = `AI Assist modal dismissed for topic: enable-2fa`,
  AiAssistResetPasswordPositiveReaction = `Positive experience with AI Assist for topic: reset-password`,
  AiAssistResetPasswordNegativeReaction = `Negative experience with AI Assist for topic: reset-password`,
  AiAssistSetup2faPositiveReaction = `Positive experience with AI Assist for topic: enable-2fa`,
  AiAssistSetup2faNegativeReaction = `Negative experience with AI Assist for topic: enable-2fa`,
}
