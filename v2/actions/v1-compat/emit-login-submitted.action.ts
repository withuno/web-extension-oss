import type { ExtensionContext } from "@/v1/uno_types";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const EmitLoginSubmitted = UnoOrchestrator.registerAction({
  id: "emit-login-submitted",
  zone: Zone.Content,
  async execute(input: {
    v1ExtensionContext?: ExtensionContext | null;
    usernameInputSelector: string;
    passwordInputSelector: string;
  }): Promise<void> {
    const { store } = this.context;
    const v1ExtensionContext = input.v1ExtensionContext ?? (await store.getState()).v1.extensionContext;

    if (!v1ExtensionContext) {
      return;
    }

    const usernameInput = document.querySelector<HTMLInputElement>(input.usernameInputSelector);
    const passwordInput = document.querySelector<HTMLInputElement>(input.passwordInputSelector);

    if (!usernameInput || !passwordInput) {
      return;
    }

    const { loginSubmitted } = await import("@/v1/content/content_script");
    await loginSubmitted({ ...v1ExtensionContext, modalTickTime: 15_000 }, usernameInput, passwordInput);
  },
});

export const EmitPartialLoginSubmitted = UnoOrchestrator.registerAction({
  id: "emit-partial-login-submitted",
  zone: Zone.Content,
  async execute(input: { v1ExtensionContext?: ExtensionContext | null; password: string }): Promise<void> {
    const { store } = this.context;
    const v1ExtensionContext = input.v1ExtensionContext ?? (await store.getState()).v1.extensionContext;

    if (!v1ExtensionContext) {
      return;
    }

    const { partialLoginSubmitted } = await import("@/v1/content/content_script");
    await partialLoginSubmitted({
      ...v1ExtensionContext,
      saveLoginPassword: input.password,
    });
  },
});
