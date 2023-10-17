import { useCallbackConst, useConst } from "usable-react";

import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { MagicWandIcon, PadlockIcon, UnoLogo } from "@/v2/ui/components/svgs";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { Link, createSearchParams, useNavigate, useSearchParams } from "@/v2/ui/router";

import { AiAssistInterruptAutomation } from "./automation/interrupt-automation.action";
import { isLoginPage as detectLoginPage } from "./objectives/login.objective";
import { EnableSetting } from "../settings/enable-setting.action";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.AiAssistConsentModal,
  element: <AiAssistConsentModal />,
  layout: <Modal.Layout />,
}));

function AiAssistConsentModal() {
  const { orchestrator } = useUnoOrchestrator();
  const close = useCloseLayer();
  const interruptAutomationAndClose = useCallbackConst(async () => {
    await orchestrator.useAction(AiAssistInterruptAutomation)();
    await close();
  });

  const [searchParams] = useSearchParams();
  const proceedHref = useConst(() => {
    const nextSearchParams = createSearchParams(searchParams, {
      lightbox: true,
      keepAlive: true,
    });
    return `${Path.AiAssistAutomation}?${nextSearchParams}`;
  });

  const navigate = useNavigate();
  const enableAiAssistAndProceed = useCallbackConst(async () => {
    await orchestrator.useAction(EnableSetting)(FeatureFlag.AiAssist);
    navigate(proceedHref);
  });

  const isLoginPage = useConst(() => detectLoginPage());

  return (
    <Hotkey pattern="esc" onActivate={interruptAutomationAndClose}>
      <Hotkey pattern="enter" onActivate={enableAiAssistAndProceed}>
        <div className="w-screen max-w-[300px] p-6">
          <div className="flex flex-col items-center">
            <UnoLogo
              className="h-[64px] w-[64px]"
              style={{
                boxShadow:
                  "0px 0px 0px 0px rgba(255, 60, 0, 0.11), 0px 3px 7px 0px rgba(255, 60, 0, 0.11), -1px 12px 12px 0px rgba(255, 60, 0, 0.10), -3px 27px 17px 0px rgba(255, 60, 0, 0.06), -5px 49px 20px 0px rgba(255, 60, 0, 0.02), -8px 76px 21px 0px rgba(255, 60, 0, 0.00)",
              }}
            />
            <div className="mt-4 font-bold">Use Uno AI?</div>
          </div>

          <div className="mt-4">
            <div className="flex w-full items-start">
              <div className="mr-4 w-[16px] shrink-0">
                <MagicWandIcon className="w-full fill-black" />
              </div>
              <div className="flex flex-col text-xs">
                <div className="font-semibold">More reliable 1-click login</div>
                <div className="mt-1 text-[#717280]">In 1-click Uno AI will log in to any website — more reliably.</div>
              </div>
            </div>

            <div className="mt-4 flex w-full items-start">
              <div className="mr-4 w-[16px] shrink-0">
                <PadlockIcon className="w-[12px] fill-black" />
              </div>
              <div className="flex flex-col text-xs">
                <div className="font-semibold">Privacy conscious</div>
                <div className="mt-1 text-[#717280]">
                  Web content data will be shared with 3rd parties. Data is not retained to train models.
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              className="mr-2 mt-4 flex h-[37px] w-full cursor-pointer items-center justify-center rounded-full bg-[#B0FF00] px-2.5"
              onClick={enableAiAssistAndProceed}
            >
              <div className="mr-2 text-[9px] font-bold uppercase text-black">Log in with AI</div>
              <div className="min-w-[16px] rounded bg-[#264E25] p-[3px] text-[7px] font-bold uppercase text-white">
                Enter
              </div>
            </button>

            {isLoginPage ? (
              <Link
                className="mr-2 mt-4 flex h-[37px] w-full cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] px-2.5 text-[9px] font-bold uppercase text-[#717280]"
                to={proceedHref}
              >
                Log in without AI
              </Link>
            ) : (
              <button
                className="mr-2 mt-4 flex h-[37px] w-full cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] px-2.5"
                onClick={interruptAutomationAndClose}
              >
                <div className="mr-2 text-[9px] font-bold uppercase text-[#717280]">Cancel</div>
                <div className="min-w-[16px] rounded bg-[#717280] p-[3px] text-[7px] font-bold uppercase text-white">
                  Esc
                </div>
              </button>
            )}
          </div>
        </div>
      </Hotkey>
    </Hotkey>
  );
}
