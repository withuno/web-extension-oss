import { Fragment, useState } from "react";

import { VisibleVaultItemBySchemaType, UpdateQuery, CreateQuery, SecureNoteItem } from "@/v1/uno_types";

import style from "./popup_add_edit.modules.css";
import { BackChevron, TrashButton } from "./svgs";

function PlainTextGroup(props: any) {
  return (
    <div className={style.primaryGroup}>
      <div className={style.primaryGroupSub}>
        <div className={style.primaryGroupLabel}>{props.label}</div>
        <div className={style.primaryGroupValue}>
          <input
            className={style.primaryGroupInput}
            size={40}
            disabled={props.disabled}
            required
            placeholder={props.placeholder}
            value={props.value}
            onChange={props.change}
            onFocus={props.focus}
          />
        </div>
      </div>
    </div>
  );
}

function TextareaGroup(props: any) {
  return (
    <div className={style.primaryGroup}>
      <div className={`${style.primaryGroupSub} ${style.textarea}`}>
        <div className={style.primaryGroupLabel}>{props.label}</div>
        <div className={`${style.primaryGroupValue} ${style.textarea}`}>
          <textarea
            className={style.primaryGroupTextarea}
            disabled={props.disabled}
            required
            placeholder={props.placeholder}
            value={props.value}
            onChange={props.change}
            onFocus={props.focus}
          />
        </div>
      </div>
    </div>
  );
}

export interface SecureNoteItemFormProps {
  networkBusy: boolean;
  vaultItem: VisibleVaultItemBySchemaType<"secure_note"> | undefined;
  title: string;
  prefilledUrl?: string;
  isAutoSecureItem?: boolean;
  handleClickBack(): void;
  handleSave(q: UpdateQuery<SecureNoteItem> | CreateQuery<SecureNoteItem>): void;
  handleDelete?(e: React.MouseEvent): void;
}

export default function SecureNoteItemForm(props: SecureNoteItemFormProps) {
  const [title, setTitle] = useState(props.vaultItem && props.vaultItem.title ? props.vaultItem.title : "");

  const [notes, setNotes] = useState(props.vaultItem && props.vaultItem.notes ? props.vaultItem.notes : "");

  const handleTitle = (e: Event) => {
    if (e.target) {
      setTitle((e.target as HTMLInputElement).value);
    }
  };

  const handleNotes = (e: Event) => {
    if (e.target) {
      setNotes((e.target as HTMLInputElement).value);
    }
  };

  const handleSave = () => {
    const updatedSecureNoteItem: CreateQuery<SecureNoteItem> | UpdateQuery<SecureNoteItem> = {
      ...props.vaultItem,
      title,
      notes,
    };

    props.handleSave(updatedSecureNoteItem);
  };

  const formEnabled = !props.networkBusy;

  const saveEnabled = formEnabled && title.length > 0 && notes.length > 0;

  let content = (
    <div className={style.primaryContentContainer}>
      {/* Title */}
      <div className={style.primaryContent}>
        <PlainTextGroup disabled={!formEnabled} label="Title" value={title} placeholder="title" change={handleTitle} />
      </div>

      {/* Notes */}
      <div className={style.primaryContent}>
        <TextareaGroup disabled={!formEnabled} label="Notes" value={notes} placeholder="notes" change={handleNotes} />
      </div>
    </div>
  );

  if (props.networkBusy) {
    content = (
      <div className={style.spinnerContainer}>
        <img className={style.spinner} src="../images/popup_spinner.svg" />
      </div>
    );
  }

  return (
    <>
      <div className={style.header}>
        <div className={style.headerDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>
          <div className={style.headerDetailsDescription}>{props.title}</div>
        </div>

        <div className={style.headerButtonGroup}>
          {props.handleDelete !== undefined && (
            <button
              style={{ cursor: "pointer" }}
              onClick={props.handleDelete}
              className={`${style.deleteButtonContainer}`}
            >
              <TrashButton />
            </button>
          )}

          <button
            disabled={!saveEnabled}
            className={saveEnabled ? style.saveButtonContainer : style.saveButtonContainerDisabled}
            onClick={saveEnabled ? handleSave : undefined}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                padding: "0px",
                gap: "4px",
                width: "25px",
                height: "11px",
                flex: "none",
                order: "0",
                flexGrow: "0",
              }}
            >
              <div className={style.saveButtonText}>SAVE</div>
            </div>
          </button>
        </div>
      </div>
      <div className={style.separator} />
      {content}
    </>
  );
}
