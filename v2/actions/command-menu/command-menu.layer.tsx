import { useCallback, useState } from "react";

import creditCardType from "credit-card-type";
import { useInterval } from "usable-react";

import { E2E } from "@/e2e";
import { generateCardName } from "@/v1/content/autocomplete";
import * as cmdMenu from "@/v1/content/cmd_menu";
import { CreditCardItem } from "@/v1/uno_types";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";
import { UnoOrchestrator } from "@/v2/orchestrator";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { useUnoStore } from "@/v2/store";
import {
  ProfileIcon,
  PasswordGenIcon,
  SetupPeekabooIcon,
  SendFeedbackIcon,
  InviteIcon,
  CreditCardIcon,
  ScanInboxIcon,
  QRCodeIcon,
} from "@/v2/ui/components/svgs";
import { useLayer } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { generatePath, useNavigate, useSearchParams } from "@/v2/ui/router";

import { CommandMenuItem } from "./components/command-menu-item";
import { CommandMenuShell } from "./components/command-menu-shell";
import { CommandMenuShortcutBanner } from "./components/shortcut-banner";
import { CreateAnalyticsEvent } from "../analytics/create-analytics-event.action";
import { ViewPasswordGeneratorHint } from "../product-hints/password-generator-hint.action";
import { CallCommandMenuFn } from "../v1-compat/call-command-menu-fn.action";
import { useSiteItems } from "../vault/use-site-items";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.CommandMenu,
  element: <CommandMenuRoot />,
  layout: <Modal.Layout />,
}));

function CommandMenuRoot() {
  const { orchestrator } = useUnoOrchestrator();
  const v1ExtensionContext = useUnoStore((state) => state.v1.extensionContext);

  const navigate = useNavigate();
  const layer = useLayer();

  const callV1CommandMenuFn = useCallback(
    async (type: string) => {
      await orchestrator.useAction(CallCommandMenuFn)({
        v1ExtensionContext,
        type,
      });
    },
    [v1ExtensionContext],
  );

  const siteItems = useSiteItems();

  const creditCardItem1 = siteItems?.creditCards[0];
  const creditCardItem1Name = useCreditCardName(creditCardItem1);
  const creditCardItem2 = siteItems?.creditCards[1];
  const creditCardItem2Name = useCreditCardName(creditCardItem2);
  const showCreditCards = useHasCreditCardTargets();

  const siteLoginItem1 = siteItems?.items[0];
  const siteLoginItem2 = siteItems?.items[1];

  const [searchParams] = useSearchParams();
  const showShortcutBanner = searchParams.get("showShortcutBanner") === "true";

  return (
    <CommandMenuShell variant="menu" {...E2E.TestTarget(E2E.TestID.CommandMenu)}>
      {showShortcutBanner && <CommandMenuShortcutBanner />}

      {/* --- Shortcuts for credit card items --- */}
      {/* TODO: support more than credit card 2 items? */}
      {showCreditCards && creditCardItem1 && (
        <CommandMenuItem
          id="credit-card-item-1"
          label={creditCardItem1Name!} // we know this will be defined because `creditCardItem1` is defined in this path...
          icon={<CreditCardIcon className="h-[10px] w-[14px] fill-current" />}
          onActivate={() => {
            navigate(
              generatePath(Path.CommandSubmenu, {
                id: creditCardItem1.id,
              }),
            );
          }}
        />
      )}

      {showCreditCards && creditCardItem2 && (
        <CommandMenuItem
          id="credit-card-item-2"
          label={creditCardItem2Name!} // we know this will be defined because `creditCardItem2` is defined in this path...
          icon={<CreditCardIcon className="h-[10px] w-[14px] fill-current" />}
          onActivate={() => {
            navigate(
              generatePath(Path.CommandSubmenu, {
                id: creditCardItem2.id,
              }),
            );
          }}
        />
      )}

      {/* --- Shortcuts for login items --- */}
      {/* TODO: support more than login 2 items? */}
      {siteLoginItem1 && siteLoginItem1.username && siteLoginItem1.password && (
        <CommandMenuItem
          id="login-item-1"
          label={`${siteLoginItem1.username} login`}
          icon={<ProfileIcon className="h-[11px] w-[10px] fill-current" />}
          onActivate={() => {
            navigate(
              generatePath(Path.CommandSubmenu, {
                id: siteLoginItem1.id,
              }),
            );
          }}
        />
      )}

      {siteLoginItem2 && siteLoginItem2.username && siteLoginItem2.password && (
        <CommandMenuItem
          id="login-item-2"
          label={`${siteLoginItem2.username} login`}
          icon={<ProfileIcon className="h-[11px] w-[10px] fill-current" />}
          onActivate={() => {
            navigate(
              generatePath(Path.CommandSubmenu, {
                id: siteLoginItem2.id,
              }),
            );
          }}
        />
      )}

      {/* --- Standard command menu actions --- */}
      <CommandMenuItem
        id="pw-gen"
        label="Generate a strong password"
        icon={<PasswordGenIcon className="h-[13px] w-[14px] fill-current" />}
        searchShortcut="p"
        onActivate={() => {
          orchestrator.useAction(CreateAnalyticsEvent)({
            type: LegacyAnalyticsEvent.CmdMenuGenerateStrongPasswordOpened,
          });
          orchestrator.useAction(ViewPasswordGeneratorHint)(layer);
          navigate(Path.PasswordGenerator);
        }}
      />

      {v1ExtensionContext?.gmailScannerSetup ? (
        <CommandMenuItem
          id="scan-inbox"
          label="Peek at last email"
          icon={<ScanInboxIcon className="h-[10px] w-[12px] fill-current" />}
          searchShortcut="g"
          searchAliases={["peek", "peak", "peekaboo", "peakaboo"]}
          onActivate={() => callV1CommandMenuFn(cmdMenu.CMD_ID_GMAIL_SCANNING)}
        />
      ) : (
        <CommandMenuItem
          id="setup-peekaboo"
          label="Set up Peekaboo"
          icon={<SetupPeekabooIcon className="-mr-1 h-[26px] w-[24px] fill-current" />}
          searchShortcut="s"
          searchAliases={["setup", "peek", "peak", "peekaboo", "peakaboo"]}
          onActivate={() => callV1CommandMenuFn(cmdMenu.CMD_ID_SETUP_PEEKABOO)}
        />
      )}

      {!!siteLoginItem1 && (
        <CommandMenuItem
          id="scan-qr"
          label="Scan 2FA QR Code"
          icon={<QRCodeIcon className="h-[12px] w-[12px] fill-current" />}
          searchShortcut="q"
          onActivate={() => callV1CommandMenuFn(cmdMenu.CMD_ID_SCAN_QR)}
        />
      )}

      <CommandMenuItem
        id="feedback"
        label="Send us feedback"
        icon={<SendFeedbackIcon className="h-[14px] w-[14px] fill-current" />}
        searchShortcut="f"
        onActivate={() => callV1CommandMenuFn(cmdMenu.CMD_ID_FEEDBACK)}
      />

      <CommandMenuItem
        id="invite"
        label="Invite a friend to Uno"
        icon={<InviteIcon className="h-[11px] w-[14px] fill-current" />}
        searchShortcut="i"
        onActivate={() => callV1CommandMenuFn(cmdMenu.CMD_ID_INVITE_FRIEND)}
      />
    </CommandMenuShell>
  );
}

function useCreditCardName(cc?: CreditCardItem) {
  if (!cc) {
    return undefined;
  }

  let cardName = cc.name;
  if (!cardName) {
    const ccTypeInfo = creditCardType(cc.number);
    cardName = generateCardName(cc.number, ccTypeInfo);
  }

  return cardName;
}

function useHasCreditCardTargets() {
  const [hasCreditCardTargets, setHasCreditCardTargets] = useState(() => {
    return !!document.querySelector('[autocomplete|="cc"]');
  });

  useInterval(
    () => {
      setHasCreditCardTargets(!!document.querySelector('[autocomplete|="cc"]'));
    },
    [],
    2500,
  );

  return hasCreditCardTargets;
}
