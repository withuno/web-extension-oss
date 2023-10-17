import { useState, useEffect, Fragment } from "react";

import { E2E } from "@/e2e";
import { VisibleVaultItemBySchemaType } from "@/v1/uno_types";
import { createAnalyticsEvent } from "@/v1/utils";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";
import { GenerateOneTimeCodeFromSeed } from "@/v2/actions/vault/generate-totp.action";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";

import DynamicLogo from "./DynamicLogo";
import EditIcon from "./EditIcon";
import style from "./popup_show.modules.css";
import { BackChevron } from "./svgs";

function handleClickUsername(v: VisibleVaultItemBySchemaType<"login">) {
  createAnalyticsEvent(LegacyAnalyticsEvent.UsernameCopied);
  if (v.username) {
    return navigator.clipboard.writeText(v.username);
  }
  return Promise.resolve();
}

function handleClickPassword(v: VisibleVaultItemBySchemaType<"login">) {
  createAnalyticsEvent(LegacyAnalyticsEvent.PasswordCopied);

  return navigator.clipboard.writeText(v.password);
}

function TextareaGroup(props: any) {
  return (
    <div className={style.primaryContentTextContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          <div className={style.primaryContentItemValue}>{props.value}</div>
        </div>
      </div>
    </div>
  );
}

function PrimaryPasswordGroup(props: any) {
  const [passwordRevealed, setPasswordRevealed] = useState(false);

  return (
    <div className={props.last ? style.primaryContentItemContainerLast : style.primaryContentItemContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          {!passwordRevealed && (
            <div
              onClick={() => {
                setPasswordRevealed(true);
              }}
              className={style.primaryContentItemValue}
              style={{ cursor: "pointer" }}
            >
              &#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;
            </div>
          )}
          {passwordRevealed && <div className={style.primaryContentItemValue}>{props.value}</div>}
        </div>
        {props.copyFn != null && (
          <div className={style.primaryContentItemRight}>
            <button className={style.copyButton} onClick={props.copyFn}>
              {props.copyText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrimaryGroup(props: any) {
  return (
    <div className={props.last ? style.primaryContentItemContainerLast : style.primaryContentItemContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          <div className={style.primaryContentItemValue}>{props.value}</div>
        </div>
        {props.copyFn != null && (
          <div className={style.primaryContentItemRight}>
            <button className={style.copyButton} onClick={props.copyFn}>
              {props.copyText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface LoginItemViewProps {
  networkBusy: boolean;
  vaultItem: VisibleVaultItemBySchemaType<"login">;
  handleClickBack(): void;
  handleClickEdit(v: VisibleVaultItemBySchemaType<"login">): void;
}

export default function LoginItemView(props: LoginItemViewProps) {
  const [rollingMfaCode, setRollingMFACode] = useState("");
  const [usernameCopied, setUsernameCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);

  let timeout: ReturnType<typeof setTimeout> | undefined;

  const { orchestrator } = useUnoOrchestrator();

  async function updateRollingMfa() {
    if (props.vaultItem === null) return;

    const code = await orchestrator.useAction(GenerateOneTimeCodeFromSeed)({ seed: props.vaultItem.otpSeed });

    setRollingMFACode(code);

    timeout = setTimeout(updateRollingMfa, 30000);
  }

  useEffect(
    function () {
      if (props.vaultItem !== undefined && props.vaultItem.otpSeed !== undefined) {
        updateRollingMfa();
      }

      return () => {
        if (timeout !== undefined) {
          window.clearTimeout(timeout);
        }
      };
    },
    [props.vaultItem],
  );

  useEffect(
    function () {
      setTimeout(function () {
        setUsernameCopied(false);
        setPasswordCopied(false);
        setOtpCopied(false);
      }, 5000);

      return () => {};
    },
    [usernameCopied, passwordCopied, otpCopied],
  );

  if (props.networkBusy) {
    return (
      <div className={style.spinnerContainer}>
        <img className={style.spinner} src="../images/popup_spinner.svg" />
      </div>
    );
  }

  return (
    <>
      <div className={style.header}>
        <div className={style.serviceDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>

          <div className={style.vaultItemEllipse}>
            <DynamicLogo fallback="images/manual_entry.svg" url={props.vaultItem.url} />
          </div>
          <div className={style.vaultItemName}>{props.vaultItem.name}</div>
        </div>

        <div
          className={style.actionButton}
          onClick={() => {
            props.vaultItem !== null ? props.handleClickEdit(props.vaultItem) : null;
          }}
          {...E2E.TestTarget(E2E.TestID.LoginItemEditButton)}
        >
          <EditIcon />
        </div>
      </div>
      <div className={style.separator} />

      <div className={style.contentContainer}>
        <div className={style.primaryContent}>
          {!!props.vaultItem.name && (
            <PrimaryGroup last={false} label="Title" value={props.vaultItem.name ? props.vaultItem.name : ""} />
          )}

          {!!props.vaultItem.username && (
            <PrimaryGroup
              last={false}
              label="Username"
              value={props.vaultItem.username ? props.vaultItem.username : ""}
              copyText={usernameCopied ? "Copied" : "Copy"}
              copyFn={() => {
                handleClickUsername(props.vaultItem);
                setUsernameCopied(true);
              }}
            />
          )}

          <PrimaryPasswordGroup
            last={false}
            label="Password"
            value={props.vaultItem.password ? props.vaultItem.password : ""}
            copyText={passwordCopied ? "Copied" : "Copy"}
            copyFn={() => {
              handleClickPassword(props.vaultItem);
              setPasswordCopied(true);
            }}
          />

          <PrimaryGroup
            last
            label="2 Factor Code"
            value={props.vaultItem.otpSeed ? rollingMfaCode : "no 2FA set up"}
            copyText={otpCopied ? "Copied" : "Copy"}
            copyFn={
              props.vaultItem.otpSeed
                ? () => {
                    createAnalyticsEvent(LegacyAnalyticsEvent.MFACopied);

                    navigator.clipboard.writeText(rollingMfaCode);
                    setOtpCopied(true);
                  }
                : null
            }
          />
        </div>

        <TextareaGroup label="Notes" value={props.vaultItem.notes ? props.vaultItem.notes : ""} copyFn={null} />
      </div>
    </>
  );
}
