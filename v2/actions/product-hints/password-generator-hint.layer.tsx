import { UnoOrchestrator } from "@/v2/orchestrator";
import { Hotkey } from "@/v2/orchestrator/hotkeys";
import { LightbulbIcon } from "@/v2/ui/components/svgs";
import { useCloseLayer } from "@/v2/ui/layers/layer-context";
import { Tooltip } from "@/v2/ui/layers/layouts/tooltip";
import { Path } from "@/v2/ui/paths";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.PasswordGeneratorHint,
  element: <PasswordGeneratorHint />,
  layout: <Tooltip.Layout />,
}));

function PasswordGeneratorHint() {
  const close = useCloseLayer();
  return (
    <Hotkey pattern="esc" onActivate={close}>
      <div className="flex items-start justify-between">
        <LightbulbIcon className="h-[24px] w-[24px] fill-current" />
        <Tooltip.CloseButton className="fill-black/20 transition-colors hover:fill-black/50" />
      </div>
      <div className="mt-2 w-[200px]">
        Use ⌘ + SHIFT + 1 to select strong password. Uno will also auto save it to your vault.
      </div>
    </Hotkey>
  );
}
