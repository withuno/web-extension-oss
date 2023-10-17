import { UnoOrchestrator } from "@/v2/orchestrator";
import { Path } from "@/v2/ui/paths";
import { Redirect } from "@/v2/ui/router";

UnoOrchestrator.registerPageRoute(() => ({
  pattern: Path.WhatsNew,
  element: <WhatsNewPage />,
}));

function WhatsNewPage() {
  return <Redirect to={Path.AiAssistConsentPage} />;
}
