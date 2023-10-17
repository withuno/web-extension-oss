import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { LightbulbIcon } from "@/v2/ui/components/svgs";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Tooltip } from "@/v2/ui/layers/layouts/tooltip";
import { Path } from "@/v2/ui/paths";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.MagicLoginHint,
  element: <MagicLoginHint />,
  layout: <Tooltip.Layout />,
}));

function MagicLoginHint() {
  const close = useCloseLayer();
  return (
    <Hotkey pattern="esc" onActivate={close}>
      <div className="flex items-start justify-between">
        <LightbulbIcon className="h-[24px] w-[24px] fill-current" />
        <Tooltip.CloseButton className="fill-black/20 transition-colors hover:fill-black/50" />
      </div>
      <div className="mt-2 w-[200px]">
        Magic Login signs you into websites in 1-Click. Select a login to see it in action.
      </div>
    </Hotkey>
  );
}
