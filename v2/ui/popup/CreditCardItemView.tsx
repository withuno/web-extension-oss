import { useState, useEffect, Fragment } from "react";

import { VisibleVaultItemBySchemaType, VisibleVaultItem } from "@/v1/uno_types";
import { createAnalyticsEvent } from "@/v1/utils";
import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";

import { CreditCardExpirationDisplay, CreditCardNumberDisplay } from "./CreditCardFields";
import EditIcon from "./EditIcon";
import style from "./popup_show.modules.css";
import { BackChevron } from "./svgs";

function copyToClipboard(analyticsEvent: LegacyAnalyticsEvent, data: string) {
  createAnalyticsEvent(analyticsEvent);
  return navigator.clipboard.writeText(data);
}

function CreditCardNumberGroup(props: any) {
  return (
    <div className={style.primaryContentItemContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          <div className={style.primaryContentItemValue}>
            <CreditCardNumberDisplay value={props.value} />
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

function CreditCardExpirationGroup(props: any) {
  return (
    <div className={style.primaryContentItemContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          <div className={style.primaryContentItemValue}>
            <CreditCardExpirationDisplay value={props.value} />
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

function CvvGroup(props: any) {
  const [cvvRevealed, setCvvRevealed] = useState(false);

  return (
    <div className={style.primaryContentItemContainer}>
      <div className={style.primaryContentItem}>
        <div className={style.primaryContentItemLeft}>
          <div className={style.primaryContentItemLabel}>{props.label}</div>
          <div
            onClick={() => {
              setCvvRevealed(true);
            }}
            className={style.primaryContentItemValue}
            style={{ cursor: !cvvRevealed ? "pointer" : "text" }}
          >
            {!cvvRevealed ? "•".repeat(props.value.length) : props.value}
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

export interface CreditCardItemViewProps {
  vaultItem: VisibleVaultItemBySchemaType<"credit_card">;
  networkBusy: boolean;
  handleClickBack(): void;
  handleClickEdit(v: VisibleVaultItem): void;
}

export default function CreditCardItemView(props: CreditCardItemViewProps) {
  const [cardNumberCopied, setCardNumberCopied] = useState(false);
  const [expirationCopied, setExpirationCopied] = useState(false);
  const [cvvCopied, setCvvCopied] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(function () {
      setCardNumberCopied(false);
      setExpirationCopied(false);
      setCvvCopied(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [cardNumberCopied, expirationCopied, cvvCopied]);

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

          <div
            className={style.vaultItemEllipse}
            style={{
              backgroundColor: props.vaultItem.brand_color ? props.vaultItem.brand_color : "#FFFFFF",
            }}
          >
            {/* <ServiceLogo vaultItem={vaultItem} /> */}
            <img src="images/creditcard_sm.svg" />
          </div>
          <div className={style.vaultItemName}>{props.vaultItem.name}</div>
        </div>

        <div
          className={style.actionButton}
          onClick={() => {
            props.vaultItem !== undefined ? props.handleClickEdit(props.vaultItem) : null;
          }}
        >
          <EditIcon />
        </div>
      </div>
      <div className={style.separator} />

      <div className={style.contentContainer}>
        <div className={style.primaryContent}>
          <PlainTextGroup label="Card Holder" value={props.vaultItem.holder ?? ""} />

          <CreditCardNumberGroup
            label="Card Number"
            value={props.vaultItem.number ?? ""}
            copyText={cardNumberCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.number) {
                copyToClipboard(LegacyAnalyticsEvent.CreditCardNumberCopied, props.vaultItem.number);
                setCardNumberCopied(true);
              }
            }}
          />

          <PlainTextGroup label="Title" value={props.vaultItem.name ?? ""} />

          <CreditCardExpirationGroup
            label="Expiration"
            value={props.vaultItem.expiration ?? ""}
            copyText={expirationCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.expiration) {
                const formattedExpiration = `${props.vaultItem.expiration.substring(
                  0,
                  2,
                )}/${props.vaultItem.expiration.substring(2, 4)}`;
                copyToClipboard(LegacyAnalyticsEvent.CreditCardExpirationCopied, formattedExpiration);
                setExpirationCopied(true);
              }
            }}
          />

          {!!props.vaultItem.cvv && (
            <CvvGroup
              label="CVV"
              value={props.vaultItem.cvv ?? ""}
              copyText={cvvCopied ? "Copied" : "Copy"}
              copyFn={() => {
                if (props.vaultItem.cvv) {
                  copyToClipboard(LegacyAnalyticsEvent.CreditCardCvvCopied, props.vaultItem.cvv);
                  setCvvCopied(true);
                }
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
