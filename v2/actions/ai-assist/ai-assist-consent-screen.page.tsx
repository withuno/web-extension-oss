/* eslint-disable jsx-a11y/media-has-caption */

import { useCallback } from "react";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useCallbackConst } from "usable-react";

import { UnoOrchestrator } from "@/v2/orchestrator";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { useUnoStore } from "@/v2/store";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { UnoLogo, MagicWandIcon, PadlockIcon } from "@/v2/ui/components/svgs";
import { useBoolean } from "@/v2/ui/hooks/state/use-boolean";
import { useCloseCurrentWindow } from "@/v2/ui/hooks/use-close-window";
import { Path } from "@/v2/ui/paths";
import { useSearchParams } from "@/v2/ui/router";

import { ToggleSetting } from "../settings/toggle-setting.action";

UnoOrchestrator.registerPageRoute(() => ({
  pattern: Path.AiAssistConsentPage,
  element: <AiAssistConsentPage />,
}));

function AiAssistConsentPage() {
  const { orchestrator } = useUnoOrchestrator();
  const closeCurrentWindow = useCloseCurrentWindow();

  const aiAssistEnabled = useUnoStore((state) => {
    return state.settings.enabledFeatures.includes(FeatureFlag.AiAssist);
  });
  const toggleAiAssistEnabled = useCallbackConst(async () => {
    await orchestrator.useAction(ToggleSetting)(FeatureFlag.AiAssist);
  });

  const returnToOnboarding = useCallbackConst(() => {
    // @start V1_COMPAT
    const onboardBase = chrome.runtime.getURL("onboard.html");
    window.location.assign(`${onboardBase}?skipToEnd=true`);
    // @end V1_COMPAT
  });

  const [showConfirmation, setShowConfirmation] = useBoolean(false);
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.has("onboard");
  const enableAiAssistAndProceed = useCallback(async () => {
    await toggleAiAssistEnabled();
    if (isOnboarding) {
      // Provenance: Onboarding flow
      setTimeout(() => {
        returnToOnboarding();
      }, 500);
    } else {
      // Provenance: "What's New?" page
      setTimeout(() => {
        setShowConfirmation.on();
      }, 500);
    }
  }, [isOnboarding]);

  return (
    <div className="flex h-screen w-screen">
      <div className={clsx("m-auto flex max-h-screen basis-1/2 justify-center", !showConfirmation && "overflow-auto")}>
        <div className="max-w-screen mx-12 mb-6 mt-12 w-[544px]">
          <motion.div key="1" layout="position" className="flex w-full flex-col items-center">
            <UnoLogo
              className="h-[80px] w-[80px]"
              style={{
                boxShadow:
                  "0px 0px 0px 0px rgba(255, 60, 0, 0.11), 0px 3px 7px 0px rgba(255, 60, 0, 0.11), -1px 12px 12px 0px rgba(255, 60, 0, 0.10), -3px 27px 17px 0px rgba(255, 60, 0, 0.06), -5px 49px 20px 0px rgba(255, 60, 0, 0.02), -8px 76px 21px 0px rgba(255, 60, 0, 0.00)",
              }}
            />
            <div className="mt-8 font-bold">{showConfirmation ? "Thanks for using Uno AI!" : "Introducing Uno AI"}</div>
            {showConfirmation && (
              <div className="mt-6 flex items-center justify-center pb-6">
                <button
                  className="flex h-[37px] w-[120px] cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] px-2.5"
                  onClick={closeCurrentWindow}
                >
                  <div className="text-[9px] font-bold uppercase text-[#717280]">Close this tab</div>
                </button>
              </div>
            )}
          </motion.div>

          {!showConfirmation && (
            <>
              <motion.div key="2" className="mt-12">
                <div className="flex w-full items-start rounded-xl border border-[#E4E4E4] p-4">
                  <div className="mr-4 w-[16px] shrink-0">
                    <MagicWandIcon className="w-full fill-black" />
                  </div>
                  <div className="flex flex-col text-[14px]">
                    <div className="font-semibold">More reliable 1-click login</div>
                    <div className="mt-1 text-xs text-[#717280]">
                      In 1-click Uno AI will log in to any website — more reliably.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex w-full items-start rounded-xl border border-[#E4E4E4] p-4">
                  <div className="mr-4 w-[16px] shrink-0">
                    <PadlockIcon className="w-[12px] fill-black" />
                  </div>
                  <div className="flex flex-col text-xs">
                    <div className="text-[14px] font-semibold">Privacy conscious</div>
                    <div className="mt-1 text-xs text-[#717280]">
                      All AI features are opt-in. Data is not retained to train models. Nothing is ever sent without
                      consent first.
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div key="3" className="mt-12">
                <div className="text-center font-bold">Turn on Uno AI to get started</div>

                <button
                  className="group relative mt-6 inline-flex aspect-[2.4_/_1] w-full shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-[#E6EAEE] transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B0FF00] focus-visible:ring-offset-2 aria-checked:bg-[#B0FF00]"
                  onClick={enableAiAssistAndProceed}
                  role="switch"
                  aria-checked={aiAssistEnabled}
                  disabled={showConfirmation}
                  aria-label="Use special characters in generated password"
                >
                  <span className="pointer-events-none absolute left-[2%] top-1/2 inline-block aspect-square w-[38%] -translate-y-1/2 translate-x-0 rounded-full bg-white shadow ring-0 transition-all duration-200 ease-in-out group-aria-checked:left-full group-aria-checked:translate-x-[-105%]" />
                </button>

                {isOnboarding && (
                  <div className="mt-6 flex items-center justify-center pb-6">
                    <button
                      className="flex h-[37px] w-[120px] cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] px-2.5"
                      onClick={returnToOnboarding}
                    >
                      <div className="text-[9px] font-bold uppercase text-[#717280]">Skip</div>
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>

      <div className="relative flex basis-1/2 items-center justify-center overflow-hidden p-8">
        {/* B.G. grid pattern */}
        <div className="absolute left-0 top-1/2 -z-10 flex w-full -translate-y-1/2 flex-wrap">
          <div className="aspect-square w-1/2 bg-[#FFF9E9]" />
          <div className="aspect-square w-1/2 bg-[#E5B380]" />
          <div className="aspect-square w-1/2 bg-[#E5B380]" />
          <div className="aspect-square w-1/2 bg-[#FFF9E9]" />
          <div className="aspect-square w-1/2 bg-[#FFF9E9]" />
          <div className="aspect-square w-1/2 bg-[#E5B380]" />
        </div>

        {/* Video demo (auto-playing on a loop) */}
        <video loop autoPlay className="w-full rounded-xl border border-[#E4E4E4]/50 shadow-2xl">
          <source src="images/ai-assist-login-demo.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
