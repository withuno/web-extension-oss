import { useCallback, useEffect, useMemo, useState } from "react";

import { LoginTarget } from "@withuno/locust";
import { clsx } from "clsx";
import { useCallbackConst, useClipboard } from "usable-react";

import { textFill } from "@/v1/content/utils";
import { Password, PasswordRequirement } from "@/v2/crypto/password-generator/password-generator.types";
import { generateRandomPassword } from "@/v2/crypto/password-generator/random-password";
import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey, useHotkey } from "@/v2/orchestrator/hotkeys";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { UnoLogo } from "@/v2/ui/components/svgs";
import { useBoolean } from "@/v2/ui/hooks/state/use-boolean";
import { useIsDemoHost } from "@/v2/ui/hooks/use-demo-host";
import { useQuerySelector } from "@/v2/ui/hooks/use-query-selector";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { useSearchParams } from "@/v2/ui/router";
import { EventHandlers } from "@/v2/ui/ui.types";
import { cleanArray } from "@/v2/utils/arrays";
import { generateCssSelector } from "@/v2/utils/css";

import { LegacyAnalyticsEvent } from "../analytics/analytics.types";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { EmitLoginSubmitted, EmitPartialLoginSubmitted } from "../v1-compat/emit-login-submitted.action";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.PasswordGenerator,
  element: <PasswordGenerator />,
  layout: <Modal.Layout />,
}));

function PasswordGenerator() {
  const { orchestrator } = useUnoOrchestrator();
  const close = useCloseLayer();

  // @start V1_COMPAT
  const keepPasswordGeneratorClosed = useCallbackConst(async () => {
    const { setKeepSuggestStrongPWClosed } = await import("@/v1/content/content_script");
    setKeepSuggestStrongPWClosed(true);
  });
  // @end V1_COMPAT

  const [password, setPassword] = useState(() => {
    return generateRandomPassword(36, [PasswordRequirement.Numbers, PasswordRequirement.Symbols]);
  });

  const isDemoHost = useIsDemoHost();

  const [searchParams] = useSearchParams();
  const passwordInput = useQuerySelector<HTMLInputElement>(searchParams.get("passwordInput"));
  const confirmPasswordInput = useQuerySelector<HTMLInputElement>(searchParams.get("confirmPasswordInput"));

  const [showPasswordCustomizations, setShowPasswordCustomizations] = useBoolean(false);

  const { copy } = useClipboard();
  const handleCopyPassword = useCallback(() => {
    copy(password.toString());
  }, [password]);

  useHotkey("ctrl+shift+1, command+shift+1", {
    onActivate: handleCopyPassword,
  });

  const handleAutofill = useCallback(async () => {
    handleCopyPassword();
    if (passwordInput) {
      textFill(passwordInput, password.toString());
      if (confirmPasswordInput) {
        textFill(confirmPasswordInput, password.toString());
      }

      // @start V1_COMPAT
      const { setStrongPWEntered } = await import("@/v1/content/content_script");
      setStrongPWEntered(true);
      const usernameInput = LoginTarget.find(document, { visible: true })?.get("username");
      if (usernameInput && usernameInput.value) {
        await orchestrator.useAction(EmitLoginSubmitted)({
          usernameInputSelector: generateCssSelector(usernameInput),
          passwordInputSelector: generateCssSelector(passwordInput),
        });
      } else {
        await orchestrator.useAction(EmitPartialLoginSubmitted)({
          password: password.toString(),
        });
      }
    }
    // @end V1_COMPAT

    if (isDemoHost) {
      await orchestrator.useAction(CreateAnalyticsEvent)({
        type: LegacyAnalyticsEvent.DemoPasswordAutofilled,
      });
    }

    close();
  }, [handleCopyPassword, password, isDemoHost, close]);

  return (
    <Hotkey
      pattern="esc"
      onActivate={() => {
        close();
        keepPasswordGeneratorClosed();
      }}
    >
      <div className="w-[290px] p-4">
        <div className="flex w-full flex-col">
          <div className="flex items-start justify-between">
            <UnoLogo className="h-[40px] w-[40px]" />
            <div className="flex items-center justify-center">
              <Modal.FeedbackButton className="mr-2" />
              <Modal.CloseButton onClose={keepPasswordGeneratorClosed} />
            </div>
          </div>
        </div>

        <p className="my-4 text-[14px] font-bold leading-[18px]">Use a unique super strong password?</p>

        {/* "Big green button" */}
        {/* TODO: make this a real button to replace the separate "copy" button */}
        <button
          className="w-full truncate rounded-full border border-[#a3e80c] bg-[#f1ffd1] p-4 text-center text-[9px] font-semibold text-[#036a00]"
          onClick={handleAutofill}
        >
          {password.toString()}
        </button>

        {/* Copy password button */}
        <button
          className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] p-2.5"
          onClick={handleCopyPassword}
        >
          <span className="mr-2 text-[9px] font-bold uppercase text-[#717280]">Copy to Clipboard</span>
          <KeyboardShortcutIcons />
        </button>

        <div className={clsx("mt-4", showPasswordCustomizations ? "block" : "hidden")}>
          <RandomPasswordOptions setPassword={setPassword} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <PasswordStrengthIndicator password={password} />

          <button onClick={setShowPasswordCustomizations.toggle}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.120605 6.64551C0.120605 7.19922 0.428223 7.67822 0.880859 7.92871V9.06689C0.880859 9.44482 1.21484 9.74365 1.58398 9.74365C1.9707 9.74365 2.28711 9.44922 2.28711 9.06689V7.92871C2.74414 7.68262 3.05176 7.19922 3.05176 6.64551C3.05176 6.0918 2.74414 5.6084 2.28711 5.3623V1.33691C2.28711 0.95459 1.96191 0.655762 1.58398 0.655762C1.22803 0.655762 0.880859 0.958984 0.880859 1.33691V5.3623C0.428223 5.6084 0.120605 6.0918 0.120605 6.64551ZM4.91064 9.74365C5.29736 9.74365 5.61377 9.44922 5.61377 9.06689V5.09863C6.06641 4.84814 6.37842 4.36475 6.37842 3.81104C6.37842 3.26172 6.06641 2.77832 5.61377 2.52783V1.33252C5.61377 0.95459 5.28418 0.655762 4.91064 0.655762C4.55469 0.655762 4.20752 0.958984 4.20752 1.33252V2.52783C3.75488 2.77832 3.44727 3.26172 3.44727 3.81104C3.44727 4.35596 3.75488 4.84375 4.20752 5.09424V9.06689C4.20752 9.44482 4.5415 9.74365 4.91064 9.74365ZM6.77393 6.64551C6.77393 7.19922 7.08154 7.67822 7.53418 7.92871V9.06689C7.53418 9.44482 7.86816 9.74365 8.2373 9.74365C8.62402 9.74365 8.94043 9.44922 8.94043 9.06689V7.92871C9.39307 7.67822 9.70508 7.19922 9.70508 6.64551C9.70508 6.0918 9.39307 5.6084 8.94043 5.3623V1.33691C8.94043 0.95459 8.61084 0.655762 8.2373 0.655762C7.88135 0.655762 7.53418 0.958984 7.53418 1.33691V5.3623C7.08154 5.6084 6.77393 6.0918 6.77393 6.64551ZM4.26465 3.81104C4.26465 3.45508 4.55469 3.16504 4.91064 3.16504C5.27979 3.16504 5.56104 3.45508 5.56104 3.81104C5.56104 4.18018 5.27979 4.46143 4.91064 4.46143C4.55469 4.46143 4.26465 4.18018 4.26465 3.81104ZM0.937988 6.64551C0.937988 6.28955 1.22803 5.99951 1.58398 5.99951C1.95312 5.99951 2.23438 6.28955 2.23438 6.64551C2.23438 7.01465 1.95312 7.2915 1.58398 7.2915C1.22803 7.2915 0.937988 7.01465 0.937988 6.64551ZM7.59131 6.64551C7.59131 6.28955 7.88135 5.99951 8.2373 5.99951C8.60645 5.99951 8.8877 6.28955 8.8877 6.64551C8.8877 7.01465 8.60645 7.2915 8.2373 7.2915C7.88135 7.2915 7.59131 7.01465 7.59131 6.64551Z"
                fill="#A6A8AC"
              />
            </svg>
          </button>
        </div>
      </div>
    </Hotkey>
  );
}

// TODO: abstract to an OS-aware component...
function KeyboardShortcutIcons() {
  return (
    <div className="flex items-center gap-0.5 text-[7px] font-bold uppercase text-white">
      <span className="min-w-[16px] rounded bg-[#717280] p-[3px]">⌘</span>
      <span className="min-w-[16px] rounded bg-[#717280] p-[3px]">Shift</span>
      <span className="min-w-[16px] rounded bg-[#717280] p-[3px]">1</span>
    </div>
  );
}

interface PasswordProps {
  password: Password;
}

interface SetPasswordProps {
  setPassword: React.Dispatch<React.SetStateAction<Password>>;
}

function PasswordStrengthIndicator(props: PasswordProps) {
  const { password } = props;

  const approxSecondsToHack = useMemo(() => {
    return password.calculateApproximateSecondsToHack();
  }, [password]);

  const strengthLabel = useMemo(() => {
    const SECONDS_IN_AN_HOUR = 3600;
    const SECONDS_IN_A_DAY = 86_400;
    const SECONDS_IN_A_WEEK = 604_800;
    const SECONDS_IN_A_YEAR = 3.154e7;
    const SECONDS_IN_A_DECADE = 3.154e8;
    const SECONDS_IN_A_CENTURY = 3.154e9;

    if (approxSecondsToHack < 60) {
      return "Seconds";
    }

    if (approxSecondsToHack < SECONDS_IN_AN_HOUR) {
      return "Minutes";
    }

    if (approxSecondsToHack < SECONDS_IN_A_DAY) {
      return "Hours";
    }

    if (approxSecondsToHack < SECONDS_IN_A_WEEK) {
      return "Days";
    }

    if (approxSecondsToHack < SECONDS_IN_A_WEEK * 8) {
      return "Weeks";
    }

    if (approxSecondsToHack < SECONDS_IN_A_YEAR) {
      return "Months";
    }

    if (approxSecondsToHack < SECONDS_IN_A_DECADE) {
      return "Years";
    }

    if (approxSecondsToHack < SECONDS_IN_A_CENTURY) {
      return "Decades";
    }

    return "Centuries";
  }, [approxSecondsToHack]);

  return (
    <div className="flex items-center rounded-full border border-[#e4e4e4] px-2 py-1.5 text-[9px] text-[#717280]">
      <svg width="9" height="12" viewBox="0 0 9 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2.64746 8.72754H6.09277C6.22754 8.72754 6.33594 8.68652 6.41797 8.60449C6.50293 8.51953 6.54541 8.41113 6.54541 8.2793V7.69482C6.54541 7.48389 6.59961 7.28467 6.70801 7.09717C6.81641 6.90674 6.94824 6.71191 7.10352 6.5127C7.26172 6.31348 7.41992 6.09521 7.57812 5.85791C7.73926 5.61768 7.87256 5.34229 7.97803 5.03174C8.08643 4.72119 8.14062 4.35938 8.14062 3.94629C8.14062 3.39551 8.0498 2.89307 7.86816 2.43896C7.68652 1.98193 7.42871 1.58936 7.09473 1.26123C6.76074 0.930176 6.3623 0.675293 5.89941 0.496582C5.43945 0.317871 4.92969 0.228516 4.37012 0.228516C3.81055 0.228516 3.29932 0.317871 2.83643 0.496582C2.37646 0.675293 1.97949 0.930176 1.64551 1.26123C1.31152 1.58936 1.05371 1.98193 0.87207 2.43896C0.69043 2.89307 0.599609 3.39551 0.599609 3.94629C0.599609 4.35938 0.653809 4.72119 0.762207 5.03174C0.870605 5.34229 1.00391 5.61768 1.16211 5.85791C1.32031 6.09521 1.47852 6.31348 1.63672 6.5127C1.79492 6.71191 1.92676 6.90674 2.03223 7.09717C2.14062 7.28467 2.19482 7.48389 2.19482 7.69482V8.2793C2.19482 8.41113 2.2373 8.51953 2.32227 8.60449C2.40723 8.68652 2.51562 8.72754 2.64746 8.72754ZM3.28906 8.50342C3.28906 8.38037 3.28906 8.2749 3.28906 8.18701C3.28906 8.09912 3.28906 8.0127 3.28906 7.92773C3.28906 7.83984 3.28906 7.7373 3.28906 7.62012C3.28906 7.32715 3.23486 7.06348 3.12646 6.8291C3.021 6.59473 2.88916 6.37207 2.73096 6.16113C2.57568 5.9502 2.41895 5.73633 2.26074 5.51953C2.10254 5.30273 1.9707 5.06836 1.86523 4.81641C1.75977 4.56152 1.70703 4.27148 1.70703 3.94629C1.70703 3.42188 1.81689 2.96338 2.03662 2.5708C2.25928 2.17822 2.56982 1.87354 2.96826 1.65674C3.3667 1.43994 3.83398 1.33154 4.37012 1.33154C4.90625 1.33154 5.37354 1.43994 5.77197 1.65674C6.17041 1.87354 6.48096 2.17822 6.70361 2.5708C6.92627 2.96338 7.0376 3.42188 7.0376 3.94629C7.0376 4.27148 6.9834 4.56152 6.875 4.81641C6.76953 5.06836 6.6377 5.30273 6.47949 5.51953C6.32422 5.73633 6.16748 5.9502 6.00928 6.16113C5.85107 6.37207 5.71924 6.59473 5.61377 6.8291C5.5083 7.06348 5.45557 7.32715 5.45557 7.62012C5.45557 7.80469 5.45557 7.95996 5.45557 8.08594C5.45557 8.21191 5.45557 8.35107 5.45557 8.50342L6.18945 7.67725H2.55518L3.28906 8.50342ZM4.37012 11.2983C4.74805 11.2983 5.06152 11.2178 5.31055 11.0566C5.55957 10.8955 5.6958 10.6831 5.71924 10.4194H3.021C3.04736 10.6831 3.18213 10.8955 3.42529 11.0566C3.67139 11.2178 3.98633 11.2983 4.37012 11.2983ZM2.66943 10.0767H6.0708C6.21143 10.0767 6.33008 10.0254 6.42676 9.92285C6.52637 9.82324 6.57617 9.70752 6.57617 9.57568C6.57617 9.44092 6.52637 9.32227 6.42676 9.21973C6.33008 9.12012 6.21143 9.07031 6.0708 9.07031H2.66943C2.52881 9.07031 2.40869 9.12012 2.30908 9.21973C2.2124 9.32227 2.16406 9.44092 2.16406 9.57568C2.16406 9.70752 2.2124 9.82324 2.30908 9.92285C2.40869 10.0254 2.52881 10.0767 2.66943 10.0767Z"
          fill="#717280"
        />
      </svg>
      <span className="ml-1 font-bold">Time to Hack:</span>
      <span className="ml-[3px]">{strengthLabel}</span>
    </div>
  );
}

function RandomPasswordOptions(props: SetPasswordProps) {
  const { setPassword } = props;

  const [pwLength, setPwLength] = useState(36);
  const [pwHasNumbers, setPwHasNumbers] = useState(true);
  const [pwHasSymbols, setPwHasSymbols] = useState(true);

  const handlePwLengthChange = useCallbackConst<EventHandlers<"input">["onChange"]>((e) => {
    setPwLength(Number(e.target.value));
  });

  const togglePwHasNumbers = useCallbackConst(() => {
    setPwHasNumbers((curr) => !curr);
  });

  const togglePwHasSymbols = useCallbackConst(() => {
    setPwHasSymbols((curr) => !curr);
  });

  // Sync password customization & generate/set a new password.
  useEffect(() => {
    setPassword(
      generateRandomPassword(
        pwLength,
        cleanArray([pwHasNumbers && PasswordRequirement.Numbers, pwHasSymbols && PasswordRequirement.Symbols]),
      ),
    );
  }, [pwLength, pwHasNumbers, pwHasSymbols]);

  return (
    <div className="text-[10px] text-[#798088] [&>:not(:first-child)]:mt-2">
      <div className="flex items-center justify-between">
        <div aria-hidden="true">Length</div>
        <div className="ml-7 flex items-center">
          <div className="mr-2 text-[10px] font-bold">{pwLength}</div>
          <input
            className="styled-slider h-[3px] w-[150px]"
            value={pwLength}
            onChange={handlePwLengthChange}
            type="range"
            min="6"
            max="100"
            aria-label="Set length of generated password"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div aria-hidden="true">Numbers</div>
        <button
          className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-[#E6EAEE] transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 aria-checked:bg-[#007AFF]"
          onClick={togglePwHasNumbers}
          role="switch"
          aria-checked={pwHasNumbers}
          aria-label="Use numbers in generated password"
        >
          <span className="pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-aria-checked:translate-x-5" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div aria-hidden="true">Symbols</div>
        <button
          className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-[#E6EAEE] transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 aria-checked:bg-[#007AFF]"
          onClick={togglePwHasSymbols}
          role="switch"
          aria-checked={pwHasSymbols}
          aria-label="Use special characters in generated password"
        >
          <span className="pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-aria-checked:translate-x-5" />
        </button>
      </div>
    </div>
  );
}

function MemorablePasswordOptions(props: SetPasswordProps) {
  const { setPassword } = props;

  return (
    <>
      {/* TODO */}
      {/* @see UNO-1538 */}
    </>
  );
}
