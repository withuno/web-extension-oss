import { useEffect, useMemo, useRef } from "react";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { useCallbackConst, useEffectOnce } from "usable-react";

import { AiAssistDetermineNextSteps } from "@/v2/actions/ai-assist/automation/determine-next-steps.action";
import { AiAssistExecuteEffect } from "@/v2/actions/ai-assist/automation/execute-effect.action";
import { AiAssistInterruptAutomation } from "@/v2/actions/ai-assist/automation/interrupt-automation.action";
import { generateSelectorForAnnotatedID } from "@/v2/actions/ai-assist/dom/annotate-element";
import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { useUnoStore } from "@/v2/store";
import { Automation } from "@/v2/store/slices/ai-assist.slice";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { CheckmarkFill, UnoLogo, Warning } from "@/v2/ui/components/svgs";
import { useCloseLayer, useLayer } from "@/v2/ui/layers/layer-context";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { sleep } from "@/v2/utils/async";

import { CreateLayer } from "../layers/create-layer.action";
import { RemoveLayer } from "../layers/remove-layer.action";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.AiAssistAutomation,
  element: <AiAssistAutomation />,
  layout: <Modal.Layout />,
}));

// We give the page 3s to settle... (TODO: is there a better heuristic out there?)
const waitForInitialPageLoad = sleep(3000);

// Since we might arrive at this page via a `<Redirect>`, we need some state
// outside the React lifecycle to track whether we've already initiated AI
// automation effects.
let didResume = false;

function AiAssistAutomation() {
  const close = useCloseLayer();
  const { resumeAutomation, interruptAutomation } = useAutomation();

  const status = useUnoStore((state) => state.aiAssist.status);
  const uiLabel = useAutomationLabel();

  useEffect(() => {
    switch (status) {
      case "interrupted": {
        close();
        break;
      }

      case "error":
      case "done/fail":
      case "done/finish": {
        setTimeout(close, 2000);
        break;
      }

      default: {
        // Continue running...
      }
    }
  }, [status]);

  useEffectOnce(() => {
    if (!didResume) {
      resumeAutomation();
      didResume = true;
    }
  });

  const interruptAutomationAndClose = useCallbackConst(async () => {
    await interruptAutomation();
    await close();
  });

  return (
    <Hotkey pattern="esc" onActivate={interruptAutomationAndClose}>
      <motion.div layout={false} className="flex w-[260px] flex-col p-4">
        <div className="flex items-center">
          <div className="mr-4 self-start">
            <UnoLogo className="h-[40px] w-[40px]" />
          </div>
          <div className="text-xs">
            <div className={clsx("flex grow items-start font-semibold", uiLabel.textColor)}>
              <span className="mr-1 mt-0.5">{uiLabel.icon}</span>
              <span>{uiLabel.title}</span>
            </div>
            {!!uiLabel.subtitle && <div className="mt-1 text-[#717280]">{uiLabel.subtitle}</div>}
          </div>
        </div>

        {["idle", "running", "interrupted"].includes(status) && (
          <button
            className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-full bg-[#f7f8f9] p-2.5"
            onClick={interruptAutomationAndClose}
            disabled={status === "interrupted"}
          >
            <div className="mr-2 text-[9px] font-bold uppercase text-[#717280]">Cancel</div>
            <div className="min-w-[16px] rounded bg-[#717280] p-[3px] text-[7px] font-bold uppercase text-white">
              Esc
            </div>
          </button>
        )}
      </motion.div>
    </Hotkey>
  );
}

function useAutomation() {
  const createSkrim = useSkrimFactory();

  const { orchestrator } = useUnoOrchestrator();
  const queue = useRef<Array<Automation.Effect>>([]);

  const getNextSteps = useCallbackConst(async () => {
    const nextSteps = await orchestrator.useAction(AiAssistDetermineNextSteps)();
    console.debug("[ai-assist] Next steps:", nextSteps);
    queue.current.push(...nextSteps);
  });

  const doNextStep = useCallbackConst(async () => {
    const currentStep = queue.current.shift();
    if (currentStep) {
      const skrimLayer = await createSkrim(currentStep);
      await orchestrator.useAction(AiAssistExecuteEffect)(currentStep);
      if (skrimLayer) {
        await orchestrator.useAction(RemoveLayer)({ id: skrimLayer.id });
      }
      if (queue.current.length === 0) {
        await getNextSteps();
        if (queue.current.length) {
          await doNextStep();
        }
      } else {
        await doNextStep();
      }
    } else {
      await getNextSteps();
      if (queue.current.length) {
        await doNextStep();
      }
    }
  });

  const resumeAutomation = useCallbackConst(async () => {
    await waitForInitialPageLoad;
    await getNextSteps().then(doNextStep);
  });

  const interruptAutomation = useCallbackConst(async () => {
    await orchestrator.useAction(AiAssistInterruptAutomation)();
  });

  return { resumeAutomation, interruptAutomation };
}

function useAutomationLabel() {
  const uiLabel = useUnoStore((state) => state.aiAssist.uiLabel);

  const icon = useMemo(() => {
    switch (uiLabel.theme) {
      case "success": {
        return <CheckmarkFill className="h-[12px] fill-green-500" />;
      }
      case "fail": {
        return <Warning className="h-[12px] fill-red-500" />;
      }
      case "neutral":
      default: {
        return undefined;
      }
    }
  }, [uiLabel]);

  const textColor = useMemo(() => {
    switch (uiLabel.theme) {
      case "success": {
        return clsx("text-green-500");
      }
      case "fail": {
        return clsx("text-red-500");
      }
      case "neutral":
      default: {
        return clsx("text-black");
      }
    }
  }, [uiLabel]);

  return {
    title: uiLabel.title,
    subtitle: uiLabel.subtitle,
    textColor,
    icon,
  };
}

function useSkrimFactory() {
  const { orchestrator } = useUnoOrchestrator();
  const layer = useLayer();

  const isAiAssistDebugModeEnabled = useUnoStore((state) => {
    return state.settings.enabledFeatures.includes(FeatureFlag.AiAssistDebugMode);
  });

  return useCallbackConst(async (currentStep: Automation.Effect) => {
    if (isAiAssistDebugModeEnabled && currentStep.payload.debugLabel && currentStep.payload.parameters?.elementId) {
      const targetSelector = generateSelectorForAnnotatedID(currentStep.payload.parameters.elementId);
      if (targetSelector) {
        return orchestrator.useAction(CreateLayer)({
          path: Path.AiAssistAutomationSkrim,
          parentLayer: layer,
          focusStrategy: "disable",
          searchParams: {
            label: currentStep.payload.debugLabel,
          },
          position: {
            referenceElement: targetSelector,
            placement: "overlay",
            padding: 10,
          },
        });
      }
    }

    return null;
  });
}
