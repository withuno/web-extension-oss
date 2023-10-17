import { LoginTarget } from "@withuno/locust";

import { Automation } from "@/v2/store/slices/ai-assist.slice";
import { Tuple } from "@/v2/types/essentials";
import { WebDriver } from "@/v2/utils/dom";

import { CommonAbilities } from "./common-abilities";
import { CreateAnalyticsEvent } from "../../analytics/create-analytics-event.action";
import { MagicLoginAnalytics } from "../../magic-login/magic-login.analytics";
import { GenerateOneTimeCodeFromSeed } from "../../vault/generate-totp.action";
import { GetSiteItems } from "../../vault/get-site-items.action";
import { AiAssistSetUILabel } from "../automation/set-ui-label.action";
import { checkAnnotationStrict, getAnnotatedID, getElementByAnnotatedID } from "../dom/annotate-element";

export interface LoginAbilityContext {
  vaultItemId: string;
}

export const LoginAbilities = [
  ...CommonAbilities,

  /**
   * Defines an ability for the AI agent to focus on and type the user's
   * username.
   */
  new Automation.AbilityDefinition({
    name: "typeUsername",
    description: "Focuses on and sets the value of an input element to the user's username",
    debugLabel: "Typing username...",
    parameters: Tuple([{ name: "elementId", type: "number" }] as const),
  }).defineEffect<LoginAbilityContext>(async function (input) {
    const { orchestrator } = this.context;
    await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.MagicLoginFilledUsername());

    const siteItems = await orchestrator.useAction(GetSiteItems)(window.location.toString());
    const usernameText = siteItems?.items?.filter(({ id }) => id === input.vaultItemId)[0]?.username;

    const target = getElementByAnnotatedID<HTMLInputElement | HTMLTextAreaElement>(input.elementId);

    if (target && usernameText) {
      WebDriver.Field.clear(target);
      WebDriver.Keyboard.simulateTyping(target, usernameText);
    }
  }),

  /**
   * Defines an ability for the AI agent to focus on and type the user's
   * password.
   */
  new Automation.AbilityDefinition({
    name: "typePassword",
    description: "Focuses on and sets the value of an input element to the user's password",
    debugLabel: "Typing password...",
    parameters: Tuple([{ name: "elementId", type: "number" }] as const),
  }).defineEffect<LoginAbilityContext>(async function (input) {
    const { orchestrator } = this.context;
    await orchestrator.useAction(CreateAnalyticsEvent)(MagicLoginAnalytics.MagicLoginFilledPassword());

    const siteItems = await orchestrator.useAction(GetSiteItems)(window.location.toString());
    const passwordText = siteItems?.items?.filter(({ id }) => id === input.vaultItemId)[0]?.password;

    const target = getElementByAnnotatedID<HTMLInputElement | HTMLTextAreaElement>(input.elementId);

    if (target && passwordText) {
      WebDriver.Field.clear(target);
      WebDriver.Keyboard.simulateTyping(target, passwordText);
    }
  }),

  /**
   * Defines an ability for the AI agent to focus on and type the user's
   * one-time MFA passcode.
   */
  new Automation.AbilityDefinition({
    name: "typeOneTimePasscode",
    description: `Focuses on and sets the value of an input element to the user's second-factor authentication code (sometimes referred to as a "one-time passcode" or "one-time password")`,
    debugLabel: "Typing one-time passcode...",
    parameters: Tuple([{ name: "elementId", type: "number" }] as const),
  }).defineEffect<LoginAbilityContext>(async function (input) {
    const { orchestrator } = this.context;
    const siteItems = await orchestrator.useAction(GetSiteItems)(window.location.toString());

    const seed = siteItems?.items?.filter(({ id }) => id === input.vaultItemId)[0]?.otpSeed;
    const code = seed ? await orchestrator.useAction(GenerateOneTimeCodeFromSeed)({ seed }) : null;

    const target = getElementByAnnotatedID<HTMLInputElement | HTMLTextAreaElement>(input.elementId);

    if (target && code) {
      WebDriver.Field.clear(target);
      WebDriver.Keyboard.simulateTyping(target, code);
    }
  }),
];

export const createLoginObjective = new Automation.ObjectiveDefinition({
  name: "login",
  model: "gpt-3.5-turbo",
  abilities: LoginAbilities,
})
  .onStart(async function (input) {
    const { orchestrator } = this.context;
    await orchestrator.useAction(AiAssistSetUILabel)({
      title: "Signing in",
    });

    const hasOtpSeed = !!(await orchestrator.useAction(GetSiteItems)(window.location.toString())).items?.filter(
      ({ id }) => id === input.vaultItemId,
    )[0]?.otpSeed;

    return hasOtpSeed
      ? "Help me log into this website. At a minimum you must successfully type my username, password, one-time passcode, and click submit on the login form."
      : "Help me log into this website. At a minimum you must successfully type my username, password, and click submit on the login form.";
  })
  .onFinish(async function () {
    const { orchestrator } = this.context;
    await orchestrator.useAction(AiAssistSetUILabel)({
      title: "Sign in complete",
      theme: "success",
    });
  })
  .onFail(async function () {
    const { orchestrator } = this.context;
    await orchestrator.useAction(AiAssistSetUILabel)({
      title: "Something went wrong",
      subtitle: "Uno couldn't complete the flow",
      theme: "fail",
    });
  })
  .onCheckEnabledAbilities(async function (input) {
    const { orchestrator } = this.context;
    const hasOtpSeed = !!(await orchestrator.useAction(GetSiteItems)(window.location.toString())).items?.filter(
      ({ id }) => id === input.vaultItemId,
    )[0]?.otpSeed;

    return hasOtpSeed
      ? this.config.abilities.map(({ type }) => type)
      : this.config.abilities.filter(({ type }) => type.name !== "typeOneTimePasscode").map(({ type }) => type);
  })
  .onDetermineNextSteps(async function (input) {
    const { orchestrator, store } = this.context;
    const currentTask = (await store.getState()).aiAssist as Automation.Task<typeof LoginAbilities>;

    const hasOtpSeed = !!(await orchestrator.useAction(GetSiteItems)(window.location.toString())).items?.filter(
      ({ id }) => id === input.vaultItemId,
    )[0]?.otpSeed;

    // Determine how far we've come in the flow so far...
    let didTypeUsername = !!currentTask.history.find(({ payload }) => payload.name === "typeUsername");
    let didTypePassword = !!currentTask.history.find(({ payload }) => payload.name === "typePassword");
    let didTypeOTP = !!currentTask.history.find(({ payload }) => payload.name === "typeOneTimePasscode");
    let didSubmit = hasOtpSeed
      ? didTypePassword && didTypeOTP && currentTask.history[currentTask.history.length - 1]?.payload.name === "click"
      : didTypePassword && currentTask.history[currentTask.history.length - 1]?.payload.name === "click";

    // Attempt to find a login target statically using `locust`. If we find one,
    // then we can create synthetic actions to save some performance and GPT
    // usage.
    const loginTarget = LoginTarget.find(document, { visible: true });

    // A list of synthetic actions to inject into the automation flow.
    const syntheticEffects: Automation.Effect[] = [];

    // We return this synthetic action to mark the flow as "finished"
    const markAutomationAsComplete = this.createSyntheticEffect("finish", {
      thought: "I should mark the automation as finished",
    });

    const usernameField = loginTarget?.get("username");
    const passwordField = loginTarget?.get("password");
    const submitButton = loginTarget?.get("submit");

    if (isLoginPage(usernameField, passwordField)) {
      // If we have found a username field statically, then we'll create a
      // synthetic effect to fill it.
      if (!didTypeUsername && usernameField) {
        const usernameFieldID = getAnnotatedID(usernameField);
        const isUsernameFieldInteractive = checkAnnotationStrict(usernameField, ["interactive", "visible"]);
        if (usernameFieldID != null && !isNaN(usernameFieldID) && isUsernameFieldInteractive) {
          didTypeUsername = true;
          syntheticEffects.push(
            this.createSyntheticEffect("typeUsername", {
              thought: "I should type the user's username",
              parameters: { elementId: usernameFieldID },
            }),
          );
        }
      }

      // If we have found a password field statically, then we'll create a
      // synthetic effect to fill it.
      if (!didTypePassword && passwordField) {
        const passwordFieldID = getAnnotatedID(passwordField);
        const isPasswordFieldInteractive = checkAnnotationStrict(passwordField, ["interactive", "visible"]);
        if (passwordFieldID != null && !isNaN(passwordFieldID) && isPasswordFieldInteractive) {
          didTypePassword = true;
          syntheticEffects.push(
            this.createSyntheticEffect("typePassword", {
              thought: "I should type the user's password",
              parameters: { elementId: passwordFieldID },
            }),
          );

          // If we have found a submit button statically, then we'll create a
          // synthetic effect to click it.
          if (!didSubmit && submitButton) {
            const submitButtonID = getAnnotatedID(submitButton);
            const isSubmitButtonInteractive = checkAnnotationStrict(submitButton, ["interactive", "visible"]);
            if (submitButtonID != null && !isNaN(submitButtonID) && isSubmitButtonInteractive) {
              didSubmit = true;
              syntheticEffects.push(
                this.createSyntheticEffect("click", {
                  thought: "I should click the form's submit button",
                  parameters: { elementId: submitButtonID },
                }),
              );
            }
          }
        }
      }

      // If we have found a password field statically, then we'll create a
      // synthetic effect to fill it.
      const mfaInput = findMFAInput();
      if (!didTypeOTP && mfaInput) {
        const mfaFieldID = getAnnotatedID(mfaInput);
        const isMfaFieldInteractive = checkAnnotationStrict(mfaInput, ["interactive", "visible"]);
        if (mfaFieldID != null && !isNaN(mfaFieldID) && isMfaFieldInteractive) {
          didTypeOTP = true;
          syntheticEffects.push(
            this.createSyntheticEffect("typeOneTimePasscode", {
              thought: "I should type the user's one-time-password for 2FA.",
              parameters: { elementId: mfaFieldID },
            }),
          );
        }
      }

      // If we have found a submit button statically, then we'll create a
      // synthetic effect to click it.
      if (!didSubmit && submitButton) {
        const submitButtonID = getAnnotatedID(submitButton);
        const isSubmitButtonInteractive = checkAnnotationStrict(submitButton, ["interactive", "visible"]);
        if (submitButtonID != null && !isNaN(submitButtonID) && isSubmitButtonInteractive) {
          didSubmit = true;
          syntheticEffects.push(
            this.createSyntheticEffect("click", {
              thought: "I should click the form's submit button",
              parameters: { elementId: submitButtonID },
            }),
          );
        }
      }
    }

    // Mark the automation as completed if we've filled all the user data we can.
    if (didTypePassword) {
      if (hasOtpSeed) {
        if (didTypeOTP && didSubmit) {
          return [...syntheticEffects, markAutomationAsComplete];
        }
      } else if (didSubmit) {
        return [...syntheticEffects, markAutomationAsComplete];
      }
    }

    // If we reach this conditional with defined synthetic actions, return those
    // and skip GPT altogether (until the next tick).
    if (syntheticEffects.length) {
      return syntheticEffects;
    }
  })
  .toFactory();

export function isLoginPage(usernameInput?: HTMLInputElement | null, passwordInput?: HTMLInputElement | null) {
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
}

function hasSignUpVerbiage(text: string) {
  if (
    text.includes("by signing up, you agree to") ||
    text.includes("by signing up, I agree to") ||
    text.includes("by creating an account, you agree to") ||
    text.includes("by creating an account, you agree with") ||
    text.includes("by registering, you agree to") ||
    text.includes("by clicking “continue” you agree to") ||
    text.includes("create an account, you agree to") ||
    text.includes("by clicking agree & join, you agree to") ||
    text.includes("by clicking this box, you agree to") ||
    text.includes("by creating an account, you agree") ||
    text.includes("by creating an account, you are agreeing to")
  ) {
    return true;
  }
  return false;
}

function findMFAInput(): HTMLInputElement | null {
  const allInputs = Array.from(document.querySelectorAll("input"));
  const mfaInputs = allInputs.filter((input: HTMLInputElement) => {
    const html = input.outerHTML;

    if (
      html.toLowerCase().trim().includes("code") ||
      html.includes("ocfEnterTextTextInput") ||
      input.autocomplete.toLowerCase().trim() === "one-time-code" ||
      input.id.toLowerCase().trim() === "totp" ||
      input.name.toLowerCase().trim() === "otp" ||
      input.name.toLowerCase().trim() === "totpPin" ||
      input.name.toLowerCase().trim() === "optcode" ||
      input.name.toLowerCase().trim() === "verificationcode" ||
      input.ariaLabel?.toLowerCase().trim() === "security code" ||
      input.ariaLabel?.toLowerCase().trim().startsWith("6 digit code") || // coinbase.com
      input.getAttribute("aria-describedby")?.trim() === "otpCode" // paypal.com
    ) {
      return true;
    }
    return false;
  });

  return mfaInputs[0] ?? null;
}
