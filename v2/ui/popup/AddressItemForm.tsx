import { Fragment, useState } from "react";

import { VisibleVaultItemBySchemaType, UpdateQuery, CreateQuery, AddressItem } from "@/v1/uno_types";

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

export interface AddressItemFormProps {
  vaultItem?: VisibleVaultItemBySchemaType<"address">;
  networkBusy: boolean;
  title: string;
  prefilledUrl?: string;
  isAutoSecureItem?: boolean;
  handleClickBack(): void;
  handleSave(q: UpdateQuery<AddressItem> | CreateQuery<AddressItem>): void;
  handleDelete?(e: React.MouseEvent): void;
}

export default function AddressItemForm(props: AddressItemFormProps) {
  const [addressLine1, setAddressLine1] = useState(
    props.vaultItem && props.vaultItem.line1 ? props.vaultItem.line1 : "",
  );

  const [addressLine2, setAddressLine2] = useState(
    props.vaultItem && props.vaultItem.line2 ? props.vaultItem.line2 : "",
  );

  const [addressCity, setAddressCity] = useState(props.vaultItem && props.vaultItem.city ? props.vaultItem.city : "");

  const [addressState, setAddressState] = useState(
    props.vaultItem && props.vaultItem.state ? props.vaultItem.state : "",
  );

  const [addressZip, setAddressZip] = useState(props.vaultItem && props.vaultItem.zip ? props.vaultItem.zip : "");

  const [addressCountry, setAddressCountry] = useState(
    props.vaultItem && props.vaultItem.country ? props.vaultItem.country : "",
  );

  const handleAddressLine1 = (e: Event) => {
    if (e.target) {
      setAddressLine1((e.target as HTMLInputElement).value);
    }
  };

  const handleAddressLine2 = (e: Event) => {
    if (e.target) {
      setAddressLine2((e.target as HTMLInputElement).value);
    }
  };

  const handleAddressCity = (e: Event) => {
    if (e.target) {
      setAddressCity((e.target as HTMLInputElement).value);
    }
  };

  const handleAddressState = (e: Event) => {
    if (e.target) {
      setAddressState((e.target as HTMLInputElement).value);
    }
  };

  const handleAddressZip = (e: Event) => {
    if (e.target) {
      setAddressZip((e.target as HTMLInputElement).value);
    }
  };

  const handleAddressCountry = (e: Event) => {
    if (e.target) {
      setAddressCountry((e.target as HTMLInputElement).value);
    }
  };

  const handleSave = () => {
    const updatedAddressItem: CreateQuery<AddressItem> | UpdateQuery<AddressItem> = {
      ...props.vaultItem,
      line1: addressLine1,
      line2: addressLine2,
      city: addressCity,
      state: addressState,
      zip: addressZip,
      country: addressCountry,
    };

    props.handleSave(updatedAddressItem);
  };

  const formEnabled = !props.networkBusy;

  const saveEnabled =
    formEnabled &&
    addressLine1.length > 0 && // Note: `addressLine2` is optional
    addressCity.length > 0 &&
    addressZip.length > 0 &&
    addressState.length > 0 &&
    addressCountry.length > 0;

  const content = (
    <div className={style.primaryContentContainer}>
      {/* Address line 1 */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="Address line 1"
          value={addressLine1}
          placeholder="123 Uno Ave."
          change={handleAddressLine1}
        />
      </div>

      {/* Address line 2 */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="Address line 2"
          value={addressLine2}
          placeholder="Unit 654"
          change={handleAddressLine2}
        />
      </div>

      {/* City */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="City"
          value={addressCity}
          placeholder="Unoville"
          change={handleAddressCity}
        />
      </div>

      {/* State */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="State"
          value={addressState}
          placeholder="NY"
          change={handleAddressState}
        />
      </div>

      {/* ZIP */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="ZIP Code"
          value={addressZip}
          placeholder="10001"
          change={handleAddressZip}
        />
      </div>

      {/* Country */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="Country"
          value={addressCountry}
          placeholder="USA"
          change={handleAddressCountry}
        />
      </div>
    </div>
  );

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
