import { useCallback } from "react";

import { clsx } from "clsx";
import { useCallbackConst } from "usable-react";

import type { LoginItem, SSODetails } from "@/v1/uno_types";
import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { ScrollView } from "@/v2/ui/components/scroll-view";
import { FeedbackIcon, SSOProviders, UnoLogo } from "@/v2/ui/components/svgs";
import { useBoolean } from "@/v2/ui/hooks/state/use-boolean";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { useNavigate, useSearchParams } from "@/v2/ui/router";
import { OS, Browser } from "@/v2/utils/platform";
import { capitalizeFirstLetter } from "@/v2/utils/strings";

import { StartMagicLogin } from "./start-magic-login.action";
import { OpenFeedbackModal } from "../v1-compat/open-feedback-modal.action";
import { useSiteItems } from "../vault/use-site-items";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.MagicLoginMenu,
  element: <MagicLoginMenu />,
  layout: <Modal.Layout />,
}));

function MagicLoginMenu() {
  const { orchestrator } = useUnoOrchestrator();
  const close = useCloseLayer();

  const siteItems = useSiteItems()?.items ?? [];

  const [isStartingMagicLogin, setIsStartingMagicLogin] = useBoolean(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ssoButtonPresent = !!searchParams.get("ssoButtonPresent");
  const handleActivate = useCallbackConst<MagicLoginButtonProps["onActivate"]>(async (id, ssoDetails) => {
    setIsStartingMagicLogin.on();

    await orchestrator.useAction(StartMagicLogin)({
      vaultItemID: id,
      ssoDetails,
      provenance: "context-aware-modal",
      v1Compat: { ssoButtonPresent },
    });

    if (ssoDetails) {
      await close();
    } else {
      navigate(Path.AiAssist);
    }
  });

  const openFeedback = useCallbackConst(async () => {
    await close();
    await orchestrator.useAction(OpenFeedbackModal)();
  });

  const ssoButtons: JSX.Element[] = [];
  const accountButtons: JSX.Element[] = [];

  // Collect SSO buttons for each relevant login item.
  if (ssoButtonPresent) {
    for (const item of siteItems) {
      if (item.ssoProvider) {
        item.ssoProvider.forEach((ssoDetails, i) => {
          ssoButtons.push(
            <SSOButton
              // eslint-disable-next-line react/no-array-index-key
              key={`${item.id}:sso:${i}`}
              onActivate={handleActivate}
              item={item}
              index={i + 1}
              ssoDetails={ssoDetails}
              disabled={isStartingMagicLogin}
            />,
          );
        });
      }
    }
  }

  // Collect account buttons for each relevant login item.
  for (const [i, item] of siteItems.entries()) {
    if (item.username && item.password) {
      accountButtons.push(
        <AccountButton
          key={`${item.id}:account`}
          onActivate={handleActivate}
          item={item}
          index={ssoButtons.length + i + 1}
          disabled={isStartingMagicLogin}
        />,
      );
    }
  }

  return (
    <Hotkey pattern="esc" onActivate={close}>
      <div className="w-screen max-w-[300px] p-6">
        <div className="flex flex-col items-center">
          <UnoLogo
            className="h-[64px] w-[64px]"
            style={{
              boxShadow:
                "0px 0px 0px 0px rgba(255, 60, 0, 0.11), 0px 3px 7px 0px rgba(255, 60, 0, 0.11), -1px 12px 12px 0px rgba(255, 60, 0, 0.10), -3px 27px 17px 0px rgba(255, 60, 0, 0.06), -5px 49px 20px 0px rgba(255, 60, 0, 0.02), -8px 76px 21px 0px rgba(255, 60, 0, 0.00)",
            }}
          />
          <div className="mt-4 font-bold">Login with Uno</div>
        </div>

        <ScrollView className="mt-6 flex max-h-[240px] flex-col gap-2">
          {ssoButtons}
          {accountButtons}
        </ScrollView>

        <div className="mt-6 flex items-center">
          <button
            className="mr-2 flex h-[37px] w-full cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] px-2.5"
            onClick={close}
            disabled={isStartingMagicLogin}
          >
            <div className="mr-2 text-[9px] font-bold uppercase text-[#717280]">Close</div>
            <div className="min-w-[16px] rounded bg-[#717280] p-[3px] text-[7px] font-bold uppercase text-white">
              Esc
            </div>
          </button>

          <button
            className="flex h-[37px] w-[37px] shrink-0 items-center justify-center rounded-full bg-[#ffd9d9]/75"
            onClick={openFeedback}
            disabled={isStartingMagicLogin}
          >
            <FeedbackIcon className="h-[16px] w-[16px] fill-[#fc511f]/75" />
          </button>
        </div>
      </div>
    </Hotkey>
  );
}

interface MagicLoginButtonProps {
  onActivate: (id: string, ssoDetails?: SSODetails) => void;
  item: LoginItem;
  index?: number;
  disabled?: boolean;
}

interface SSOButtonProps extends MagicLoginButtonProps {
  ssoDetails: SSODetails;
}

function SSOButton(props: SSOButtonProps) {
  const { onActivate, item, index, ssoDetails, disabled } = props;

  const handleActivate = useCallback(() => {
    onActivate(item.id, ssoDetails);
  }, [onActivate]);

  const providerLabel = capitalizeFirstLetter(ssoDetails.provider);

  const metaKeyLabel = OS.isWindows ? "CTRL " : "⌘ ";
  const modifierKeyLabel = Browser.isSafari ? "⇧ " : "";
  const hotkeyLabel = metaKeyLabel + modifierKeyLabel + index;

  return (
    <Hotkey
      pattern={Browser.isSafari ? `ctrl+shift+${index}, command+shift+${index}` : `ctrl+${index}, command+${index}`}
      disabled={typeof index !== "number"}
      onActivate={handleActivate}
    >
      <button
        className={clsx(
          "flex h-[64px] w-full shrink-0 items-center justify-between whitespace-nowrap rounded-full border border-[#E7E8EA] pl-2 pr-6 transition-colors hover:bg-[#F7F8F9] active:scale-95 active:bg-[#F7F8F9]",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={handleActivate}
      >
        <div className="mr-1 flex items-center truncate text-xs">
          <SSOProviders.Icon
            provider={ssoDetails.provider}
            className="mr-2 h-[32px] w-[32px] overflow-hidden rounded-full border border-[#E7E8EA]"
          />
          <span>Login with {providerLabel}</span>
        </div>
        <div className="rounded bg-[#B0FF00] px-1 py-[3px] text-[9px] font-semibold text-black">{hotkeyLabel}</div>
      </button>
    </Hotkey>
  );
}

function AccountButton(props: MagicLoginButtonProps) {
  const { onActivate, item, index, disabled } = props;

  const handleActivate = useCallback(() => {
    onActivate(item.id);
  }, [onActivate]);

  const metaKeyLabel = OS.isWindows ? "CTRL " : "⌘ ";
  const modifierKeyLabel = Browser.isSafari ? "⇧ " : "";
  const hotkeyLabel = metaKeyLabel + modifierKeyLabel + index;

  return (
    <Hotkey
      pattern={Browser.isSafari ? `ctrl+shift+${index}, command+shift+${index}` : `ctrl+${index}, command+${index}`}
      disabled={typeof index === "number"}
      onActivate={handleActivate}
    >
      <button
        className={clsx(
          "flex h-[64px] w-full shrink-0 items-center justify-between whitespace-nowrap rounded-full border border-[#E7E8EA] px-6 transition-all hover:bg-[#F7F8F9] active:scale-95 active:bg-[#F7F8F9]",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={handleActivate}
      >
        <div className="mr-1 truncate text-xs">{item.username}</div>
        <div className="rounded bg-[#B0FF00] px-1 py-[3px] text-[9px] font-semibold text-black">{hotkeyLabel}</div>
      </button>
    </Hotkey>
  );
}
