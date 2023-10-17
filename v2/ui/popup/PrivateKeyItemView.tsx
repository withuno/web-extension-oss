import { useState, useEffect, Fragment } from "react";

import { VisibleVaultItemBySchemaType, VisibleVaultItem } from "@/v1/uno_types";
import { createAnalyticsEvent } from "@/v1/utils";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

import EditIcon from "./EditIcon";
import style from "./popup_show.modules.css";
import { BackChevron } from "./svgs";

function copyToClipboard(analyticsEvent: LegacyAnalyticsEvent, data: string) {
  createAnalyticsEvent(analyticsEvent);
  return navigator.clipboard.writeText(data);
}

function PasswordGroup(props: any) {
  const [passwordRevealed, setPasswordRevealed] = useState(false);

  return (
    <div className={style.primaryContentItemContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          <div
            onClick={() => {
              setPasswordRevealed(true);
            }}
            className={style.primaryContentItemValue}
            style={{ cursor: !passwordRevealed ? "pointer" : "text" }}
          >
            {!passwordRevealed ? "•".repeat(props.value.length) : props.value}
          </div>
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

function PlainTextGroup(props: any) {
  return (
    <div className={style.primaryContentItemContainer}>
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

export interface PrivateKeyItemViewProps {
  networkBusy: boolean;
  vaultItem: VisibleVaultItemBySchemaType<"private_key">;
  handleClickBack(): void;
  handleClickEdit(v: VisibleVaultItem): void;
}

export default function PrivateKeyItemView(props: PrivateKeyItemViewProps) {
  const [keyCopied, setKeyCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [walletAddressesCopied, setWalletAddressesCopied] = useState<null | Array<boolean>>(null);

  useEffect(() => {
    const timeout = setTimeout(function () {
      setKeyCopied(false);
      setPasswordCopied(false);
      setWalletAddressesCopied(props.vaultItem.walletAddresses.map(() => false) ?? null);
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [keyCopied, passwordCopied, walletAddressesCopied]);

  return (
    <>
      <div className={style.header}>
        <div className={style.serviceDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>

          <div
            className={style.vaultItemEllipse}
            style={{
              backgroundColor: props.vaultItem.brand_color ? props.vaultItem.brand_color : "#FFFFFF",
            }}
          >
            <img src="images/password.svg" style={{ width: 18 }} />
          </div>
          <div className={style.vaultItemName}>{props.vaultItem.name}</div>
        </div>

        <div
          className={style.actionButton}
          onClick={() => {
            props.handleClickEdit(props.vaultItem);
          }}
        >
          <EditIcon />
        </div>
      </div>
      <div className={style.separator} />

      <div className={style.contentContainer}>
        <div className={style.primaryContent}>
          <PlainTextGroup label="Title" value={props.vaultItem.name ?? ""} />

          <PasswordGroup
            label="Private Key"
            value={props.vaultItem.key ?? ""}
            copyText={keyCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.key) {
                copyToClipboard(LegacyAnalyticsEvent.PrivateKeyCopied, props.vaultItem.key);
                setKeyCopied(true);
              }
            }}
          />

          {!!props.vaultItem.password && (
            <PasswordGroup
              label="Password"
              value={props.vaultItem.password ?? ""}
              copyText={passwordCopied ? "Copied" : "Copy"}
              copyFn={() => {
                if (props.vaultItem.password) {
                  copyToClipboard(LegacyAnalyticsEvent.PrivateKeyPasswordCopied, props.vaultItem.password);
                  setPasswordCopied(true);
                }
              }}
            />
          )}

          <div className={style.primaryContent}>
            {[...Array(props.vaultItem.walletAddresses.length)].map((e, i) => {
              return (
                <PlainTextGroup
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  label="Wallet Address"
                  value={props.vaultItem.walletAddresses[i]}
                  copyText={walletAddressesCopied?.[i] ? "Copied" : "Copy"}
                  copyFn={() => {
                    if (props.vaultItem.walletAddresses[i]) {
                      copyToClipboard(LegacyAnalyticsEvent.PrivateKeyAddressCopied, props.vaultItem.walletAddresses[i]);
                      setWalletAddressesCopied((curr) => {
                        const result = curr ? [...curr] : Array(props.vaultItem.walletAddresses.length);

                        result[i] = true;

                        return result;
                      });
                    }
                  }}
                />
              );
            })}
          </div>

          {!!props.vaultItem.url && <PlainTextGroup label="URL" value={props.vaultItem.url ?? ""} />}

          {!!props.vaultItem.notes && <PlainTextGroup label="Notes" value={props.vaultItem.notes ?? ""} />}
        </div>
      </div>
    </>
  );
}
