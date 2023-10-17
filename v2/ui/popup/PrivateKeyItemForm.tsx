import { Fragment, useState } from "react";

import { VisibleVaultItemBySchemaType, UpdateQuery, CreateQuery, PrivateKeyItem } from "@/v1/uno_types";

import style from "./popup_add_edit.modules.css";
import { BackChevron, TrashButton } from "./svgs";

function WalletAddressGroup(props: any) {
  return (
    <div className={style.primaryGroup}>
      <div className={style.primaryGroupSub}>
        <div className={style.primaryGroupLabel}>{props.label}</div>
        <div className={`${style.primaryGroupValue} ${style.withActionButton}`}>
          <input
            className={`${style.primaryGroupInput} ${style.withActionButton}`}
            size={40}
            disabled={props.disabled}
            required
            placeholder={props.placeholder}
            value={props.value}
            onChange={props.change}
            onFocus={props.focus}
          />
          {!!props.addWallet && (
            <button
              className={`${style.addWalletAddressButtonOuter} ${style.add}`}
              onClick={props.addWallet}
              aria-label="Add another wallet"
            >
              +
            </button>
          )}
          {!!props.subtractWallet && (
            <button
              className={`${style.addWalletAddressButtonOuter} ${style.subtract}`}
              onClick={props.subtractWallet}
              aria-label="Remove this wallet"
            >
              -
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PrimaryPasswordGroup(props: any) {
  const [passwordRevealed, setPasswordRevealed] = useState(false);

  return (
    <div className={style.primaryGroup}>
      <div className={style.primaryGroupSub}>
        <div className={style.primaryGroupLabel}>{props.label}</div>
        <div className={style.primaryGroupValue}>
          <input
            onFocus={() => {
              setPasswordRevealed(true);
            }}
            onBlur={() => {
              setPasswordRevealed(false);
            }}
            type={passwordRevealed ? undefined : "password"}
            className={style.primaryGroupInput}
            size={40}
            disabled={props.disabled}
            required
            placeholder={props.placeholder}
            value={props.value}
            onChange={props.change}
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

export interface PrivateKeyItemFormProps {
  vaultItem: VisibleVaultItemBySchemaType<"private_key"> | undefined;
  networkBusy: boolean;
  title: string;
  prefilledUrl?: string;
  isAutoSecureItem?: boolean;
  handleClickBack(): void;
  handleSave(q: UpdateQuery<PrivateKeyItem> | CreateQuery<PrivateKeyItem>): void;
  handleDelete?(e: React.MouseEvent): void;
}

export default function PrivateKeyItemForm(props: PrivateKeyItemFormProps) {
  const [privateKey, setPrivateKey] = useState(props.vaultItem && props.vaultItem.key ? props.vaultItem.key : "");

  const [password, setPassword] = useState(props.vaultItem && props.vaultItem.password ? props.vaultItem.password : "");

  const [walletAddresses, setWalletAddresses] = useState(
    props.vaultItem && props.vaultItem.walletAddresses ? props.vaultItem.walletAddresses : [],
  );
  const [numWalletAddresses, setNumWalletAddresses] = useState<number>(walletAddresses.length || 1);

  const [title, setTitle] = useState(props.vaultItem && props.vaultItem.name ? props.vaultItem.name : "");

  const [notes, setNotes] = useState(props.vaultItem && props.vaultItem.notes ? props.vaultItem.notes : "");

  const [url, setUrl] = useState(props.vaultItem && props.vaultItem.url ? props.vaultItem.url : "");

  const handlePrivateKey = (e: Event) => {
    if (e.target) {
      setPrivateKey((e.target as HTMLInputElement).value);
    }
  };

  const handlePassword = (e: Event) => {
    if (e.target) {
      setPassword((e.target as HTMLInputElement).value);
    }
  };

  const handleWalletAddresses = (i: number) => (e: Event) => {
    if (e.target) {
      setWalletAddresses((curr: any) => {
        const result = curr ? [...curr] : [];
        result[i] = (e.target as HTMLInputElement).value;
        return result;
      });
    }
  };

  const incrementWalletAddressCount = () => {
    setNumWalletAddresses((curr) => curr + 1);
  };

  const decrementWalletAddressCount = () => {
    if (props.vaultItem && props.vaultItem.walletAddresses && props.vaultItem.walletAddresses.length > 0) {
      const w = props.vaultItem.walletAddresses;
      w.pop();
      setWalletAddresses(w);
    }

    setNumWalletAddresses((curr) => {
      const nextCount = curr - 1;
      return curr < 1 ? 1 : nextCount;
    });
  };

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

  const handleUrl = (e: Event) => {
    if (e.target) {
      setUrl((e.target as HTMLInputElement).value);
    }
  };

  const handleSave = () => {
    const updatedAddressItem: CreateQuery<PrivateKeyItem> | UpdateQuery<PrivateKeyItem> = {
      ...props.vaultItem,
      key: privateKey,
      password,
      walletAddresses,
      name: title,
      notes,
      url,
    };

    props.handleSave(updatedAddressItem);
  };

  const formEnabled = !props.networkBusy;

  const saveEnabled =
    formEnabled &&
    title.length > 0 &&
    privateKey.length > 0 &&
    walletAddresses &&
    walletAddresses.length > 0 &&
    walletAddresses[0].length > 0;

  const content = (
    <div className={style.primaryContentContainer}>
      {/* Title */}
      <div className={style.primaryContent}>
        <PlainTextGroup
          disabled={!formEnabled}
          label="Title"
          value={title}
          placeholder="Title of this key"
          change={handleTitle}
        />
      </div>

      {/* Private Key */}
      <div className={style.primaryContent}>
        <PrimaryPasswordGroup
          disabled={!formEnabled}
          label="Private Key"
          value={privateKey}
          placeholder="Secret phrase or private key"
          change={handlePrivateKey}
        />
      </div>

      {/* Password */}
      <div className={style.primaryContent}>
        <PrimaryPasswordGroup
          disabled={!formEnabled}
          label="Password"
          value={password}
          placeholder="Password"
          change={handlePassword}
        />
      </div>

      {/* Wallet Addresses */}
      <div className={style.primaryContent}>
        {[...Array(numWalletAddresses)].map((e, i) => {
          return (
            <WalletAddressGroup
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              disabled={!formEnabled}
              label="Wallet Address"
              value={walletAddresses[i]}
              placeholder="0x123..."
              change={handleWalletAddresses(i)}
              addWallet={i === 0 && incrementWalletAddressCount}
              subtractWallet={i > 0 && decrementWalletAddressCount}
            />
          );
        })}
      </div>

      {/* URL */}
      <div className={style.primaryContent}>
        <PlainTextGroup disabled={!formEnabled} label="URL" value={url} placeholder="URL" change={handleUrl} />
      </div>

      {/* Notes */}
      <div className={style.primaryContent}>
        <TextareaGroup
          disabled={!formEnabled}
          label="Notes"
          value={notes}
          placeholder="Anything note-able to add?"
          change={handleNotes}
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
