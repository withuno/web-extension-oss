import { Path } from "@/v2/ui/paths";
import { URLSearchParamsInit, createSearchParams } from "@/v2/ui/router";

import { Zone, UnoOrchestrator } from "../../orchestrator";

export const OpenPage = UnoOrchestrator.registerAction({
  id: "browser/open-page",
  zone: Zone.Background,
  async execute(input: { path: Path; searchParams?: URLSearchParamsInit }): Promise<void> {
    const searchParams = createSearchParams(input.searchParams);
    const pathWithSearchParams = `${input.path}?${searchParams}`;
    await chrome.tabs.create({
      url: `${chrome.runtime.getURL("pages.html")}#${pathWithSearchParams}`,
    });
  },
});
