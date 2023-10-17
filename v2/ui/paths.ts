export enum Path {
  // Command menu
  CommandMenu = "/cmdk",
  CommandSubmenu = "/cmdk/:id",

  // Magic Login
  MagicLoginMenu = "/magic-login",

  // Password generator
  PasswordGenerator = "/password-generator",

  // Product hints
  AutocompleteHint = "/product-hint/autocomplete",
  MagicLoginHint = "/product-hint/magic-login",
  PasswordGeneratorHint = "/product-hint/password-generator",
  SaveAddressHint = "/product-hint/save-address",
  SaveCreditCardHint = "/product-hint/save-credit-card",
  SaveLoginHint = "/product-hint/save-login",

  // Autocomplete
  AutocompleteChip = "/autocomplete",

  // AI Assistant
  AiAssist = "/ai-assist",
  AiAssistAutomation = "/ai-assist/automation",
  AiAssistAutomationSkrim = "/ai-assist/automation/skrim",
  AiAssistConsentModal = "/ai-assist/automation/consent",
  AiAssistConsentPage = "/ai-assist/automation/page",

  // "What's new?"
  WhatsNew = "/whats-new",
}
