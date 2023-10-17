import { Fragment, useState } from "react";

import { VisibleVaultItemBySchemaType, CreditCardItem, UpdateQuery, CreateQuery } from "@/v1/uno_types";

import {
  CreditCardExpirationInput,
  CreditCardNumberInput,
  CreditCardNumberInputProps,
  CreditCardProvider,
  OnValueChange,
} from "./CreditCardFields";
import style from "./popup_add_edit.modules.css";
import { BackChevron, TrashButton } from "./svgs";

function CreditCardNumberGroup(props: any) {
  return (
    <div className={style.primaryGroup}>
      <div className={style.primaryGroupSub}>
        <div className={style.primaryGroupLabel}>{props.label}</div>
        <div className={style.primaryGroupValue}>
          <CreditCardNumberInput
            className={style.primaryGroupInput}
            size={40}
            disabled={props.disabled}
            placeholder={props.placeholder}
            value={props.value}
            onValueChange={props.change}
          />
        </div>
      </div>
    </div>
  );
}

function ExpirationDateGroup(props: any) {
  return (
    <div className={style.primaryGroup}>
      <div className={style.primaryGroupSub}>
        <div className={style.primaryGroupLabel}>{props.label}</div>
        <div className={style.primaryGroupValue}>
          <CreditCardExpirationInput
            className={style.primaryGroupInput}
            size={40}
            disabled={props.disabled}
            placeholder={props.placeholder}
            value={props.value}
            onValueChange={props.change}
          />
        </div>
      </div>
    </div>
  );
}

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

export interface CreditCardItemFormProps {
  vaultItem?: VisibleVaultItemBySchemaType<"credit_card">;
  title: string;
  networkBusy: boolean;
  prefilledUrl?: string;
  isAutoSecureItem?: boolean;
  handleClickBack(): void;
  handleSave(q: UpdateQuery<CreditCardItem> | CreateQuery<CreditCardItem>): void;
  handleDelete?(e: React.MouseEvent): void;
}

export default function CreditCardItemForm(props: CreditCardItemFormProps) {
  const [cardholderName, setCardholderName] = useState(
    props.vaultItem && props.vaultItem.holder ? props.vaultItem.holder : "",
  );

  const [cardNumber, setCardNumber] = useState(props.vaultItem && props.vaultItem.number ? props.vaultItem.number : "");

  const [cardProvider, setCardProvider] = useState<CreditCardProvider>("unknown");

  const [cardProviderDisplayName, setCardProviderDisplayName] = useState<string>();

  const [title, setTitle] = useState(props.vaultItem && props.vaultItem.name ? props.vaultItem.name : "");

  const [hasCustomTitle, setHasCustomTitle] = useState(props.vaultItem && !!props.vaultItem.name);

  const [expiration, setExpiration] = useState(
    props.vaultItem && props.vaultItem.expiration ? props.vaultItem.expiration : "",
  );

  const [cvv, setCvv] = useState(props.vaultItem && props.vaultItem.cvv ? props.vaultItem.cvv : "");

  const handleCardHolderNameInput = (e: Event) => {
    if (e.target) {
      setCardholderName((e.target as HTMLInputElement).value);
    }
  };

  const handleCardNumberInput: CreditCardNumberInputProps["onValueChange"] = (values, sourceInfo) => {
    setCardNumber(values.value);
    setCardProvider(sourceInfo.cardProvider);
    setCardProviderDisplayName(sourceInfo.cardProviderDisplayName);
  };

  const handleTitleInput = (e: Event) => {
    if (e.target) {
      const nextTitle = (e.target as HTMLInputElement).value;
      setTitle(nextTitle);
      setHasCustomTitle(!!nextTitle);
    }
  };

  const handleTitleInputFocus = () => {
    if (!hasCustomTitle) {
      if (cardProvider !== "unknown") {
        setTitle(`${cardProviderDisplayName} ${cardNumber.slice(-4)}`);
      } else {
        setTitle("");
      }
    }
  };

  const handleExpirationInput: OnValueChange = (values) => {
    setExpiration(values.value);
  };

  const handleCvvInput = (e: Event) => {
    if (e.target) {
      setCvv((e.target as HTMLInputElement).value);
    }
  };

  const handleSave = () => {
    const updatedCreditCardItem: Partial<CreateQuery<CreditCardItem>> | Partial<UpdateQuery<CreditCardItem>> = {
      ...props.vaultItem,
      type: cardProvider,
      name: title,
      holder: cardholderName,
      number: cardNumber,
      expiration,
      cvv,
      // addressUUID, // TODO?
    };

    props.handleSave(updatedCreditCardItem as any);
  };

  const formEnabled = !props.networkBusy;

  const saveEnabled =
    formEnabled && cardNumber.length > 0 && cardholderName.length > 0 && title.length && expiration?.length === 4;

  const content = (
    <div className={style.primaryContentContainer}>
      {/* Card holder's name */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="Card Holder"
          value={cardholderName}
          placeholder="Name"
          change={handleCardHolderNameInput}
        />
      </div>

      {/* Card number */}
      <div className={style.primaryContent}>
        <CreditCardNumberGroup
          disabled={!formEnabled}
          label="Card Number"
          value={cardNumber}
          placeholder="1234 1234 1234 1234"
          change={handleCardNumberInput}
        />
      </div>

      {/* Title */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="Title"
          value={title}
          placeholder="Mastercard 1234"
          change={handleTitleInput}
          focus={handleTitleInputFocus}
        />
      </div>

      {/* Expiration */}
      <div className={style.primaryContent}>
        <ExpirationDateGroup
          disabled={!formEnabled}
          label="Expiration"
          value={expiration}
          placeholder="MM/YY"
          change={handleExpirationInput}
        />
      </div>

      {/* CVV */}
      <div className={style.primaryContent}>
        <PlainTextGroup disabled={!formEnabled} label="CVV" value={cvv} placeholder="321" change={handleCvvInput} />
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
