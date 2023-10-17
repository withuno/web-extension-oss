import { Fragment } from "react";

import { clsx } from "clsx";
import { useCallbackConst } from "usable-react";

import { ToggleSetting } from "@/v2/actions/settings/toggle-setting.action";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";
import { useUnoStore } from "@/v2/store";
import { FeatureFlag } from "@/v2/store/slices/settings.slice";

import style from "./popup_settings.modules.css";
import { BackChevron } from "./svgs";

export default function AiAssistSettings(props: any) {
  const aiAssistEnabled = useUnoStore((state) => state.settings.enabledFeatures.includes(FeatureFlag.AiAssist));
  const { orchestrator } = useUnoOrchestrator();
  const toggleAiAssistEnabled = useCallbackConst(() => {
    orchestrator.useAction(ToggleSetting)(FeatureFlag.AiAssist);
  });

  const aiAssistDebugEnabled = useUnoStore((state) =>
    state.settings.enabledFeatures.includes(FeatureFlag.AiAssistDebugMode),
  );
  const toggleAiAssistDebugEnabled = useCallbackConst(() => {
    orchestrator.useAction(ToggleSetting)(FeatureFlag.AiAssistDebugMode);
  });

  return (
    <>
      <div className={style.header}>
        <div className={style.headerDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>
          <div className={style.headerDetailsDescription}>AI Assist (Preview)</div>
        </div>
      </div>
      <div className={style.separator} />
      <div
        style={{
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingTop: "16px",
        }}
      >
        <div className={clsx(style.aiAssistSettingsRow)}>
          <div className={style.settingItemText}>Enable AI Assist</div>
          <button
            className={style.aiAssistToggle}
            onClick={toggleAiAssistEnabled}
            role="switch"
            aria-checked={aiAssistEnabled}
            aria-label="Use numbers in generated password"
          >
            <span className="pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-aria-checked:translate-x-5" />
          </button>
        </div>

        <div
          className={clsx(style.aiAssistSettingsRow, !aiAssistEnabled && style.disabled)}
          style={{ marginTop: "16px" }}
        >
          <div className={style.settingItemText}>Enable Debug Mode</div>
          <button
            className={style.aiAssistToggle}
            onClick={toggleAiAssistDebugEnabled}
            role="switch"
            aria-checked={aiAssistDebugEnabled}
            aria-label="Use numbers in generated password"
          >
            <span className="pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-aria-checked:translate-x-5" />
          </button>
        </div>

        <div className={clsx(style.aiAssistCallout)}>
          <div className={clsx(style.aiAssistCalloutHeadline)}>✨ How It Works ✨</div>
          <div className={clsx(style.aiAssistCalloutDescription)}>
            When you activate the AI Autofill and Login feature, Uno securely communicates with our AI model to enhance
            your browsing. Rest assured, only non-sensitive information about your web pages is sent to our AI model –
            no passwords or personal data whatsoever. Your privacy and security remain our top priorities.
          </div>
        </div>

        <div className={clsx(style.aiAssistCallout)}>
          <div className={clsx(style.aiAssistCalloutHeadline)}>🌐 Your Data, Your Control 🌐</div>
          <div className={clsx(style.aiAssistCalloutDescription)}>
            We respect your privacy. Uno's AI feature operates on your explicit command, ensuring that it only engages
            when you actively use it. You're always in control of your browsing data, and the feature can be disabled at
            any time with a simple toggle.
          </div>
        </div>
      </div>
    </>
  );
}
