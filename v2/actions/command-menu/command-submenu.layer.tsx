import { useMemo, useState } from "react";

import { useClipboard, useInterval, useIsMounted } from "usable-react";

import { E2E } from "@/e2e";
import { LoginItem } from "@/v1/uno_types";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";
import { UnoOrchestrator } from "@/v2/orchestrator";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { useUnoStore } from "@/v2/store";
import {
  CreditCardCvvIcon,
  CreditCardExpirationIcon,
  CreditCardHolderIcon,
  CreditCardNumberIcon,
  KeyIcon,
  TwoFactorIcon,
  UsernameIcon,
} from "@/v2/ui/components/svgs";
import { useBoolean } from "@/v2/ui/hooks/state/use-boolean";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { useNavigate, useParams } from "@/v2/ui/router";

import { AiAssistEmbellishment } from "./components/ai-assist-embellishment";
import { CommandMenuItem } from "./components/command-menu-item";
import { CommandMenuShell } from "./components/command-menu-shell";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { StartMagicLogin } from "../magic-login/start-magic-login.action";
import { GenerateOneTimeCodeFromSeed } from "../vault/generate-totp.action";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.CommandSubmenu,
  element: <CommandSubmenu />,
  layout: <Modal.Layout />,
}));

function CommandSubmenu() {
  const { id } = useParams();
  const { orchestrator } = useUnoOrchestrator();
  const v1ExtensionContext = useUnoStore((state) => state.v1.extensionContext);

  const loginItem = useMemo(() => {
    return v1ExtensionContext?.siteVaultItems.find((vi) => {
      return vi.id === id;
    });
  }, [id, v1ExtensionContext]);

  const creditCardItem = useMemo(() => {
    return v1ExtensionContext?.creditCards.find((vi) => {
      return vi.id === id;
    });
  }, [id, v1ExtensionContext]);

  const otpCode = useTwoFactorCode(loginItem);
  const { copy } = useClipboard();

  const navigate = useNavigate();
  const close = useCloseLayer();

  const [isStartingMagicLogin, setIsStartingMagicLogin] = useBoolean(false);

  return (
    <CommandMenuShell variant="submenu" disabled={isStartingMagicLogin} {...E2E.TestTarget(E2E.TestID.CommandSubmenu)}>
      {/* --- Actions for login items --- */}
      {/* Engage Magic Login via AI Assist */}
      {!!loginItem?.username && !!loginItem?.password && (
        <CommandMenuItem
          id="login-item-magic-login"
          label="Log in automatically"
          subLabel={`for ${loginItem.username}`}
          embellishment={<AiAssistEmbellishment />}
          searchShortcut="m"
          searchAliases={["magic"]}
          icon={<UsernameIcon className="h-[10px] w-[12px] fill-current" />}
          onActivate={async () => {
            setIsStartingMagicLogin.on();
            await orchestrator.useAction(StartMagicLogin)({
              vaultItemID: id,
              provenance: "command-menu",
              v1Compat: { ssoButtonPresent: false },
            });
            navigate(Path.AiAssist);
          }}
        />
      )}

      {/* Copy username */}
      {!!loginItem?.username && (
        <CommandMenuItem
          id="login-item-username"
          label="Copy username"
          subLabel={`for ${loginItem.username}`}
          icon={<UsernameIcon className="h-[10px] w-[12px] fill-current" />}
          searchShortcut="u"
          onActivate={() => {
            copy(loginItem.username);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopyUsername,
            });
            close();
          }}
        />
      )}

      {/* Copy password */}
      {!!loginItem?.password && (
        <CommandMenuItem
          id="login-item-password"
          label="Copy password"
          subLabel={`for ${loginItem.username}`}
          icon={<KeyIcon className="h-[14px] w-[8px] fill-current" />}
          searchShortcut="p"
          onActivate={() => {
            copy(loginItem.password);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopyPassword,
            });
            close();
          }}
        />
      )}

      {/* Copy 2FA code */}
      {!!loginItem?.otpSeed && (
        <CommandMenuItem
          id="login-item-2fa"
          label="Copy 2FA"
          subLabel={`for ${loginItem.username}`}
          icon={<TwoFactorIcon className="h-[12px] w-[8px] fill-current" />}
          searchShortcut="2"
          onActivate={() => {
            copy(otpCode);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopy2FA,
            });
            close();
          }}
        />
      )}

      {/* --- Actions for credit card items --- */}
      {/* Copy CC number */}
      {!!creditCardItem?.number && (
        <CommandMenuItem
          id="credit-card-item-number"
          label="Copy credit card number"
          icon={<CreditCardNumberIcon className="h-[11px] w-[15px] fill-current" />}
          searchShortcut="c"
          onActivate={() => {
            copy(creditCardItem.number);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopyCardNumber,
            });
            close();
          }}
        />
      )}

      {/* Copy CC holder */}
      {!!creditCardItem?.holder && (
        <CommandMenuItem
          id="credit-card-item-holder"
          label="Copy name on card"
          icon={<CreditCardHolderIcon className="h-[11px] w-[10px] fill-current" />}
          searchShortcut="n"
          onActivate={() => {
            copy(creditCardItem.holder);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopyCardHolderName,
            });
            close();
          }}
        />
      )}

      {/* Copy CC expiration */}
      {!!creditCardItem?.expiration && (
        <CommandMenuItem
          id="credit-card-item-expiration"
          label="Copy expiry date"
          icon={<CreditCardExpirationIcon className="h-[12px] w-[12px] fill-current" />}
          searchShortcut="e"
          onActivate={() => {
            copy(creditCardItem.expiration);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopyCardExpiration,
            });
            close();
          }}
        />
      )}

      {/* Copy CVV */}
      {!!creditCardItem?.cvv && (
        <CommandMenuItem
          id="credit-card-item-cvv"
          label="Copy CVV code"
          icon={<CreditCardCvvIcon className="h-[9px] w-[14px] fill-current" />}
          searchShortcut="v"
          onActivate={() => {
            copy(creditCardItem.cvv);
            orchestrator.useAction(CreateAnalyticsEvent)({
              type: LegacyAnalyticsEvent.CmdMenuCopyCardCVV,
            });
            close();
          }}
        />
      )}
    </CommandMenuShell>
  );
}

function useTwoFactorCode(loginItem?: LoginItem) {
  const { orchestrator } = useUnoOrchestrator();
  const [code, setCode] = useState<string | null>(null);
  const isMounted = useIsMounted();

  useInterval(
    () => {
      if (loginItem && loginItem.otpSeed) {
        orchestrator
          .useAction(GenerateOneTimeCodeFromSeed)({
            seed: loginItem.otpSeed,
          })
          .then((nextCode) => {
            if (isMounted() && !!nextCode) {
              setCode(nextCode);
            }
          });
      }
    },
    [loginItem?.id],
    500,
  );

  return code;
}
