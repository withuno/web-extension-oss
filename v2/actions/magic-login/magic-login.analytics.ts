import { AnalyticsEvent } from "../analytics/analytics.types";

export namespace MagicLoginAnalytics {
  export const MagicLoginDisplayed = AnalyticsEvent.define("Vault Items Modal Displayed");

  export const MagicLoginUsed = AnalyticsEvent.define("Magic Login Used");
  export const MagicLoginUsedSSO = AnalyticsEvent.define("Magic login used for SSO");
  export const DemoMagicLoginUsed = AnalyticsEvent.define("Demo Magic Login Used");

  export const MagicLoginFilledUsername = AnalyticsEvent.define("Filled Username");
  export const MagicLoginFilledPassword = AnalyticsEvent.define("Filled Password");

  export const StartFromCommandMenu = AnalyticsEvent.define("Magic Login: initiated from command menu");
  export const StartFromContextAwareModal = AnalyticsEvent.define("Magic Login: initiated from context-aware modal");
}
