import { useConst } from "usable-react";

import { UnoOrchestrator } from "@/v2/orchestrator";
import { useUnoStore } from "@/v2/store";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";
import { Modal } from "@/v2/ui/layers/layouts/modal";
import { Path } from "@/v2/ui/paths";
import { Redirect, createSearchParams, useSearchParams } from "@/v2/ui/router";

UnoOrchestrator.registerLayerRoute(() => ({
  pattern: Path.AiAssist,
  element: <AiAssistRoot />,
  layout: <Modal.Layout />,
}));

function AiAssistRoot() {
  const [searchParams] = useSearchParams();
  const proceedStatically = searchParams.has("proceed");
  const aiEnabled = useUnoStore((state) => state.settings.enabledFeatures.includes(FeatureFlag.AiAssist));

  const goToAutomationHref = useConst(() => {
    const nextSearchParams = createSearchParams(searchParams, {
      proceed: true,
      lightbox: true,
      keepAlive: true,
    });
    return `${Path.AiAssistAutomation}?${nextSearchParams}`;
  });

  if (!aiEnabled && !proceedStatically) {
    return <Redirect to={Path.AiAssistConsentModal} />;
  }
  return <Redirect to={goToAutomationHref} />;
}
