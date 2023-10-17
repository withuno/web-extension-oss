import { useState, useEffect, Fragment } from "react";

import { VisibleVaultItem, VisibleVaultItemBySchemaType } from "@/v1/uno_types";
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

function TextareaGroup(props: any) {
  return (
    <div className={style.primaryContentTextContainer}>
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

export interface SecureNoteItemViewProps {
  vaultItem: VisibleVaultItemBySchemaType<"secure_note">;
  networkBusy: boolean;
  handleClickBack(): void;
  handleClickEdit(v: VisibleVaultItem): void;
}

export default function SecureNoteItemView(props: SecureNoteItemViewProps) {
  const [notesCopied, setNotesCopied] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(function () {
      setNotesCopied(false);
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [notesCopied]);

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
            <img src="images/note_sm.svg" style={{ width: 18 }} />
          </div>
          <div className={style.vaultItemName}>{props.vaultItem.title}</div>
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
          <PlainTextGroup label="Title" value={props.vaultItem.title ?? ""} />

          <TextareaGroup
            label="Notes"
            value={props.vaultItem.notes ?? ""}
            copyText={notesCopied ? "Copied" : "Copy"}
            copyFn={() => {
              if (props.vaultItem.notes) {
                copyToClipboard(LegacyAnalyticsEvent.SecureNotesCopied, props.vaultItem.notes);
                setNotesCopied(true);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}
