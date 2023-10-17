import { useState } from "react";

import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { clsx } from "clsx";
import { motion } from "framer-motion";

import { UnoOrchestrator } from "@/v2/orchestrator";
import { AnimatePresencePropagated } from "@/v2/ui/components/animate-presence-propagated";
import { transitions } from "@/v2/ui/hooks/transitions";
import { Path } from "@/v2/ui/paths";
import { WithChildren } from "@/v2/ui/prop.types";
import { useSearchParams } from "@/v2/ui/router";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.AiAssistAutomationSkrim,
  element: <AiAssistDebugSkrim />,
}));

function AiAssistDebugSkrim() {
  const scale = transitions.useScale().getProps(1.1);
  const [tooltipReference, setTooltipReference] = useState<HTMLDivElement | null>(null);

  const [searchParams] = useSearchParams();

  return (
    <motion.div
      {...scale}
      className="absolute h-full w-full rounded-lg bg-white/5 shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-saturate-[3] transition-all"
      ref={setTooltipReference}
    >
      <ActionLabelTooltip reference={tooltipReference}>{searchParams.get("label")}</ActionLabelTooltip>
    </motion.div>
  );
}

interface ActionLabelTooltipProps extends WithChildren {
  reference: HTMLDivElement | null;
}

/**
 * Annotates the curtain skrim with a label describing the current action being
 * taken.
 */
function ActionLabelTooltip(props: ActionLabelTooltipProps) {
  const { reference, children } = props;

  const { refs, floatingStyles, context } = useFloating({
    placement: "top-end",
    elements: { reference },
    middleware: [offset({ mainAxis: 5, crossAxis: -20 }), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const scale = transitions.useScale().getProps(0.9);

  return (
    <AnimatePresencePropagated>
      <div ref={refs.setFloating} style={floatingStyles}>
        <motion.div {...scale}>
          <div
            className={clsx(
              "rounded-lg bg-[#FFD729] px-2 py-1 text-xs",
              context.placement.startsWith("top") && "scale-y-[-1]",
            )}
          >
            <div className={clsx(context.placement.startsWith("top") && "scale-y-[-1]")}>{children}</div>
            <motion.div
              {...scale}
              transition={{ delay: 0.05 }}
              className="absolute right-[-5px] top-[5px] h-[10px] w-[10px] rounded-full bg-[#FFD729]"
            />
            <motion.div
              {...scale}
              transition={{ delay: 0.1 }}
              className="absolute right-[-11px] top-[2px] h-[6px] w-[6px] rounded-full bg-[#FFD729]"
            />
            <motion.div
              {...scale}
              transition={{ delay: 0.15 }}
              className="absolute right-[-8px] top-[-3px] h-[3px] w-[3px] rounded-full bg-[#FFD729]"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresencePropagated>
  );
}
