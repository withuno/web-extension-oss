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

export interface AddressItemViewProps {
  vaultItem: VisibleVaultItemBySchemaType<"address">;
  networkBusy: boolean;
  handleClickBack(): void;
  handleClickEdit(v: VisibleVaultItem): void;
}

export default function AddressItemView(props: AddressItemViewProps) {
  const [addressLine1Copied, setAddressLine1Copied] = useState(false);
  const [addressLine2Copied, setAddressLine2Copied] = useState(false);
  const [addressCityCopied, setAddressCityCopied] = useState(false);
  const [addressStateCopied, setAddressStateCopied] = useState(false);
  const [addressZipCopied, setAddressZipCopied] = useState(false);
  const [addressCountryCopied, setAddressCountryCopied] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(function () {
      setAddressLine1Copied(false);
      setAddressLine2Copied(false);
      setAddressCityCopied(false);
      setAddressStateCopied(false);
      setAddressZipCopied(false);
      setAddressCountryCopied(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [
    addressLine1Copied,
    addressLine2Copied,
    addressCityCopied,
    addressStateCopied,
    addressZipCopied,
    addressCountryCopied,
  ]);

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
            <img src="images/map.svg" style={{ width: 18 }} />
          </div>
          <div className={style.vaultItemName}>{props.vaultItem.line1}</div>
        </div>

        <div
          className={style.actionButton}
          onClick={() => {
            props.vaultItem !== null ? props.handleClickEdit(props.vaultItem) : null;
          }}
        >
          <EditIcon />
        </div>
      </div>
      <div className={style.separator} />

      <div className={style.contentContainer}>
        <div className={style.primaryContent}>
          <PlainTextGroup
            label="Address line 1"
            value={props.vaultItem.line1 ?? ""}
            copyText={addressLine1Copied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.line1) {
                copyToClipboard(LegacyAnalyticsEvent.AddressLine1Copied, props.vaultItem.line1);
                setAddressLine1Copied(true);
              }
            }}
          />

          {!!props.vaultItem.line2 && (
            <PlainTextGroup
              label="Address line 2"
              value={props.vaultItem.line2}
              copyText={addressLine2Copied ? "Copied" : "Copy"}
              copyFn={() => {
                if (props.vaultItem.line2) {
                  copyToClipboard(LegacyAnalyticsEvent.AddressLine2Copied, props.vaultItem.line2);
                  setAddressLine2Copied(true);
                }
              }}
            />
          )}

          <PlainTextGroup
            label="City"
            value={props.vaultItem.city ?? ""}
            copyText={addressCityCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.city) {
                copyToClipboard(LegacyAnalyticsEvent.AddressCityCopied, props.vaultItem.city);
                setAddressCityCopied(true);
              }
            }}
          />

          <PlainTextGroup
            label="State"
            value={props.vaultItem.state ?? ""}
            copyText={addressStateCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.state) {
                copyToClipboard(LegacyAnalyticsEvent.AddressStateCopied, props.vaultItem.state);
                setAddressStateCopied(true);
              }
            }}
          />

          <PlainTextGroup
            label="ZIP code"
            value={props.vaultItem.zip ?? ""}
            copyText={addressZipCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.zip) {
                copyToClipboard(LegacyAnalyticsEvent.AddressZipCopied, props.vaultItem.zip);
                setAddressZipCopied(true);
              }
            }}
          />

          <PlainTextGroup
            label="Country"
            value={props.vaultItem.country ?? ""}
            copyText={addressCountryCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.country) {
                copyToClipboard(LegacyAnalyticsEvent.AddressCountryCopied, props.vaultItem.country);
                setAddressCountryCopied(true);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}
