import React, { Fragment, useEffect, useState } from "react";

import { E2E } from "@/e2e";
import {
  messageToJSON,
  messageFromJSON,
  PopupActionState,
  VisibleVaultItem,
  VisibleVaultItemBySchemaType,
  UpdateQuery,
  LoginItem,
  CreateQuery,
} from "@/v1/uno_types";
import { parseOtpInput } from "@/v2/crypto/totp";

import DynamicLogo from "./DynamicLogo";
import style from "./popup_add_edit.modules.css";
import { AddedBadge, BackChevron, Remove2fa, ScanQRCode, TrashButton } from "./svgs";

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
            {...E2E.TestTarget(props)}
          />
        </div>
      </div>
    </div>
  );
}

function PrimaryGroup(props: any) {
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
            {...E2E.TestTarget(props)}
          />
        </div>
      </div>
    </div>
  );
}

function TwoFactorGroup(props: any) {
  let scanButton = <></>;

  if (props.otpSeed !== null) {
    scanButton = (
      <>
        <div className={style.scanAddedOuter}>
          <div className={style.scanAddedGroup}>
            <div className={style.scanAddedHeader}>2 Factor Code</div>
            <div>
              <div className={style.scanAdded}>
                {/* 2fa added */}
                <AddedBadge />
              </div>
            </div>
          </div>
          {/* Close */}
          {/* Add hover stuff */}
          <button
            style={{ cursor: "pointer", border: "none", background: "none" }}
            onClick={props.disabled ? undefined : props.clearScannedOtpSeed}
          >
            <Remove2fa />
          </button>
        </div>
      </>
    );
  } else {
    switch (props.scannerState) {
      case PopupActionState.Start:
        scanButton = (
          <div className={style.scanGroupSub}>
            <div className={style.scanGroup1}>
              <div className={style.scanGroupHeader}>2 Factor Code</div>
              <input
                className={style.scanGroupInput}
                size={40}
                disabled={props.disabled}
                value={props.manualOtpInput}
                onChange={props.handleManualOtpInputChange}
                placeholder="Can't scan QR code? Enter an OTP url."
              />
            </div>

            <button className={`${style.scanButtonOuter}`} onClick={props.handleScan}>
              <ScanQRCode />
            </button>
          </div>
        );

        break;
      case PopupActionState.Requested:
        scanButton = (
          <div className={style.scanButtonOuter}>
            <div className={style.scanButtonSpinnerContainer}>
              <img className={style.scanButtonSpinner} src="images/popup_spinner.svg" />
            </div>
          </div>
        );
        break;
      default:
        scanButton = (
          <div className={style.scanGroupSub}>
            <div className={style.scanGroup1}>
              <div className={style.scanGroupHeader}>2 Factor Code</div>
              <input
                className={style.primaryGroupInput}
                size={40}
                disabled={props.disabled}
                value={props.manualOtpInput}
                onChange={props.handleManualOtpInputChange}
                placeholder="Can't scan QR code? Enter an OTP url."
              />
            </div>
            <button className={style.scanButtonOuter} onClick={props.handleScan}>
              <svg width="88" height="12" viewBox="0 0 88 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M1.6875 5.05713C2.05664 5.05713 2.25439 4.85059 2.25439 4.48584V3.57178C2.25439 3.19385 2.44336 3.02246 2.79492 3.02246H3.72656C4.0957 3.02246 4.29785 2.82031 4.29785 2.45557C4.29785 2.09082 4.0957 1.88867 3.72656 1.88867H2.67188C1.66992 1.88867 1.12061 2.43359 1.12061 3.43115V4.48584C1.12061 4.85498 1.32275 5.05713 1.6875 5.05713ZM9.43945 5.05713C9.80859 5.05713 10.0063 4.85498 10.0063 4.48584V3.43115C10.0063 2.43359 9.46143 1.88867 8.45508 1.88867H7.40479C7.03125 1.88867 6.8291 2.09082 6.8291 2.45557C6.8291 2.82031 7.03564 3.02246 7.40479 3.02246H8.33203C8.68359 3.02246 8.87256 3.19385 8.87256 3.57178V4.48584C8.87256 4.85498 9.07471 5.05713 9.43945 5.05713ZM3.66504 6.14258H5.18555C5.29541 6.14258 5.37451 6.06348 5.37451 5.95361V4.43311C5.37451 4.32324 5.29541 4.24414 5.18555 4.24414H3.66504C3.55518 4.24414 3.47168 4.32324 3.47168 4.43311V5.95361C3.47168 6.06348 3.55518 6.14258 3.66504 6.14258ZM5.94141 6.14258H7.46191C7.57178 6.14258 7.65527 6.06348 7.65527 5.95361V4.43311C7.65527 4.32324 7.57178 4.24414 7.46191 4.24414H5.94141C5.83594 4.24414 5.75244 4.32324 5.75244 4.43311V5.95361C5.75244 6.06348 5.83594 6.14258 5.94141 6.14258ZM3.854 5.76025V4.62207H4.99219V5.76025H3.854ZM6.13477 5.76025V4.62207H7.27295V5.76025H6.13477ZM4.18799 5.43066H4.6626V4.95605H4.18799V5.43066ZM6.46436 5.43066H6.93896V4.95605H6.46436V5.43066ZM3.66504 8.42334H5.18555C5.29541 8.42334 5.37451 8.34424 5.37451 8.22998V6.71387C5.37451 6.604 5.29541 6.5249 5.18555 6.5249H3.66504C3.55518 6.5249 3.47168 6.604 3.47168 6.71387V8.22998C3.47168 8.34424 3.55518 8.42334 3.66504 8.42334ZM5.80518 7.05225H6.28418V6.57764H5.80518V7.05225ZM7.12354 7.05225H7.59814V6.57764H7.12354V7.05225ZM3.854 8.04102V6.90283H4.99219V8.04102H3.854ZM4.18799 7.70703H4.6626V7.23242H4.18799V7.70703ZM6.46436 7.71143H6.93896V7.23682H6.46436V7.71143ZM2.67188 10.7788H3.72656C4.0957 10.7788 4.29785 10.5767 4.29785 10.2075C4.29785 9.84277 4.0957 9.64062 3.72656 9.64062H2.79492C2.44336 9.64062 2.25439 9.46924 2.25439 9.0957V8.18164C2.25439 7.80811 2.05225 7.61035 1.6875 7.61035C1.31836 7.61035 1.12061 7.80811 1.12061 8.18164V9.23633C1.12061 10.2339 1.66992 10.7788 2.67188 10.7788ZM7.40479 10.7788H8.45508C9.46143 10.7788 10.0063 10.2295 10.0063 9.23633V8.18164C10.0063 7.80811 9.80859 7.61035 9.43945 7.61035C9.07471 7.61035 8.87256 7.8125 8.87256 8.18164V9.0957C8.87256 9.46924 8.68359 9.64062 8.33203 9.64062H7.40479C7.03125 9.64062 6.8291 9.84277 6.8291 10.2075C6.8291 10.5767 7.03125 10.7788 7.40479 10.7788ZM5.80518 8.36621H6.28418V7.896H5.80518V8.36621ZM7.12354 8.36621H7.59814V7.896H7.12354V8.36621ZM19.0742 9.6626C20.6562 9.6626 21.6318 8.86719 21.6318 7.61035V7.60596C21.6318 6.61719 21.0473 6.08105 19.707 5.8042L19.0346 5.66797C18.2876 5.51416 17.98 5.26807 17.98 4.85498V4.85059C17.98 4.37598 18.415 4.07715 19.0698 4.07275C19.7378 4.07275 20.1772 4.38916 20.2519 4.8418L20.2607 4.89453H21.5088L21.5044 4.8374C21.4209 3.77832 20.5508 2.99609 19.0698 2.99609C17.6636 2.99609 16.6528 3.77393 16.6528 4.95166V4.95605C16.6528 5.91846 17.2197 6.53369 18.5381 6.80176L19.206 6.93799C19.9927 7.10059 20.3047 7.3335 20.3047 7.75098V7.75537C20.3047 8.24316 19.8169 8.58154 19.1094 8.58154C18.3667 8.58154 17.8525 8.26074 17.8042 7.78613L17.7998 7.74219H16.521L16.5254 7.8125C16.6001 8.9375 17.5581 9.6626 19.0742 9.6626ZM25.6725 9.6626C27.2018 9.6626 28.2872 8.75732 28.4235 7.43018L28.4279 7.38184H27.1359L27.1271 7.41699C26.9865 8.09375 26.4371 8.5376 25.6769 8.5376C24.6749 8.5376 24.0553 7.69385 24.0553 6.33154V6.32275C24.0553 4.96045 24.6749 4.12109 25.6725 4.12109C26.4284 4.12109 26.9953 4.60449 27.1315 5.31641V5.34717H28.4235V5.29443C28.3004 3.9541 27.1754 2.99609 25.6725 2.99609C23.8312 2.99609 22.6974 4.26611 22.6974 6.32275V6.33154C22.6974 8.38818 23.8356 9.6626 25.6725 9.6626ZM29.0848 9.5H30.4778L30.948 7.96191H33.1849L33.6551 9.5H35.0525L32.8465 3.15869H31.2864L29.0848 9.5ZM32.0291 4.42432H32.1082L32.8816 6.96875H31.2513L32.0291 4.42432ZM36.2192 9.5H37.4892V5.44385H37.5595L40.4951 9.5H41.5937V3.15869H40.3237V7.19727H40.2534L37.3266 3.15869H36.2192V9.5ZM48.4095 9.6626C48.8181 9.6626 49.1961 9.60107 49.5345 9.48242L50.0179 10.1284H51.2527L50.4002 8.99023C51.0769 8.41895 51.4593 7.50049 51.4593 6.33154V6.32275C51.4593 4.2749 50.2771 2.99609 48.4095 2.99609C46.5418 2.99609 45.3553 4.27051 45.3553 6.32275V6.33154C45.3553 8.37939 46.5242 9.6626 48.4095 9.6626ZM48.4095 8.5376C47.3636 8.5376 46.7088 7.67188 46.7088 6.33154V6.32275C46.7088 4.97803 47.3767 4.12109 48.4095 4.12109C49.4378 4.12109 50.1057 4.97803 50.1057 6.32275V6.33154C50.1057 7.01709 49.93 7.5752 49.6223 7.96191L49.2137 7.4126H47.9788L48.7918 8.49365C48.6687 8.52441 48.5413 8.5376 48.4095 8.5376ZM52.8105 9.5H54.1376V7.17969H55.2231L56.4052 9.5H57.9081L56.5722 6.98193C57.2973 6.69629 57.7192 5.99756 57.7192 5.18457V5.17578C57.7192 3.92773 56.893 3.15869 55.4516 3.15869H52.8105V9.5ZM54.1376 6.21289V4.1958H55.289C55.9526 4.1958 56.3613 4.59131 56.3613 5.20215V5.21094C56.3613 5.83496 55.9702 6.21289 55.3066 6.21289H54.1376ZM64.2537 9.6626C65.783 9.6626 66.8684 8.75732 67.0047 7.43018L67.009 7.38184H65.7171L65.7083 7.41699C65.5676 8.09375 65.0183 8.5376 64.2581 8.5376C63.2561 8.5376 62.6365 7.69385 62.6365 6.33154V6.32275C62.6365 4.96045 63.2561 4.12109 64.2537 4.12109C65.0095 4.12109 65.5764 4.60449 65.7127 5.31641V5.34717H67.0047V5.29443C66.8816 3.9541 65.7566 2.99609 64.2537 2.99609C62.4124 2.99609 61.2786 4.26611 61.2786 6.32275V6.33154C61.2786 8.38818 62.4168 9.6626 64.2537 9.6626ZM71.0937 9.6626C72.9657 9.6626 74.1435 8.37939 74.1435 6.33154V6.32275C74.1435 4.2749 72.9613 2.99609 71.0937 2.99609C69.226 2.99609 68.0395 4.27051 68.0395 6.32275V6.33154C68.0395 8.37939 69.2084 9.6626 71.0937 9.6626ZM71.0937 8.5376C70.0478 8.5376 69.393 7.67188 69.393 6.33154V6.32275C69.393 4.97803 70.061 4.12109 71.0937 4.12109C72.122 4.12109 72.79 4.97803 72.79 6.32275V6.33154C72.79 7.67188 72.1264 8.5376 71.0937 8.5376ZM75.4947 9.5H77.9908C79.8892 9.5 80.9659 8.33984 80.9659 6.29199V6.2832C80.9659 4.29688 79.8761 3.15869 77.9908 3.15869H75.4947V9.5ZM76.8219 8.40576V4.25293H77.7799C78.9312 4.25293 79.6124 5 79.6124 6.30518V6.31396C79.6124 7.66748 78.9532 8.40576 77.7799 8.40576H76.8219ZM82.3171 9.5H86.5183V8.40576H83.6443V6.80176H86.3557V5.78223H83.6443V4.25293H86.5183V3.15869H82.3171V9.5Z"
                  fill="black"
                />
              </svg>
            </button>
          </div>
        );
    }
  }

  return <div className={style.scanGroup}>{scanButton}</div>;
}

export interface LoginItemFormProps {
  vaultItem?: VisibleVaultItemBySchemaType<"login">;
  title: string;
  networkBusy: boolean;
  prefilledUrl?: string;
  isAutoSecureItem?: boolean;
  handleClickBack(): void;
  handleSave(q: UpdateQuery<LoginItem> | CreateQuery<LoginItem>): void;
  handleDelete?(e: React.MouseEvent): void;
}

export default function LoginItemForm(props: LoginItemFormProps) {
  const existingOtpSeed = props.vaultItem && props.vaultItem.otpSeed ? props.vaultItem.otpSeed : null;

  const [scannedOtpSeed, setScannedOtpSeed] = useState<string | null>(existingOtpSeed);
  const [scannerState, setScannerState] = useState(PopupActionState.Start);
  const [manualOtpUrl, setManualOtpUrl] = useState("");

  const [scanRetryCount, setScanRetryCount] = useState(0);

  const [vaultItem, setVaultItem] = useState<VisibleVaultItem>();

  const [title, setTitle] = useState(props.vaultItem && props.vaultItem.name ? props.vaultItem.name : null);
  const [url, setUrl] = useState(
    props.vaultItem && props.vaultItem.url ? props.vaultItem.url : props.prefilledUrl ? props.prefilledUrl : "",
  );
  const [hasUrlError, setHasUrlError] = useState(false);
  const [username, setUsername] = useState(props.vaultItem && props.vaultItem.username ? props.vaultItem.username : "");
  const [password, setPassword] = useState(props.vaultItem && props.vaultItem.password ? props.vaultItem.password : "");
  const [notes, setNotes] = useState(props.vaultItem && props.vaultItem.notes ? props.vaultItem.notes : "");

  useEffect(
    function () {
      if (manualOtpUrl.length > 0) {
        const s = parseOtpInput(manualOtpUrl);
        if (s) {
          setScannedOtpSeed(s);
          setManualOtpUrl("");
          setScannerState(PopupActionState.Succeeded);
        }
      }

      return () => {};
    },
    [manualOtpUrl],
  );

  useEffect(
    function () {
      switch (scannerState) {
        case PopupActionState.Requested:
          pollQRStatus();
          break;
        default:
          break;
      }
    },
    [scannerState],
  );

  function pollQRStatus() {
    // timeout after 5 seconds
    if (scanRetryCount > 10) {
      setScannedOtpSeed(null);
      setScannerState(PopupActionState.Failed);
    }

    window.setTimeout(function () {
      chrome.runtime.sendMessage(messageToJSON({ kind: "GET_QR_SCANNER_STATE" }), function (r) {
        try {
          const message = messageFromJSON(r);
          switch (message.kind) {
            case "QR_SCANNER_STATE_RESPONSE":
              switch (message.payload.state) {
                case PopupActionState.Requested:
                  setScanRetryCount(scanRetryCount + 1);
                  return pollQRStatus();
                case PopupActionState.Succeeded:
                  if (message.payload.result === null) {
                    setScannedOtpSeed(null);
                    setScannerState(PopupActionState.Failed);

                    return;
                  }

                  {
                    const s = parseOtpInput(message.payload.result);
                    if (s === null) {
                      setScannedOtpSeed(null);
                      return;
                    }

                    setScannerState(PopupActionState.Succeeded);
                    setScannedOtpSeed(s);
                  }
                  break;
                case PopupActionState.Failed:
                  setScannedOtpSeed(null);
                  setScannerState(PopupActionState.Failed);
                  break;
                case PopupActionState.Start:
                  setScannedOtpSeed(null);
                  setScannerState(PopupActionState.Start);
                  break;
              }
              break;
            default:
              setScannedOtpSeed(null);
              setScannerState(PopupActionState.Failed);
          }
        } catch {
          setScannedOtpSeed(null);
          setScannerState(PopupActionState.Failed);
        }
      });
    }, 500);
  }

  function clickScan() {
    clearScannedOtpSeed();
    setManualOtpUrl("");
    setScannerState(PopupActionState.Requested);
    chrome.runtime.sendMessage(messageToJSON({ kind: "INJECT_QR_SCANNER" }));
  }

  function clearScannedOtpSeed() {
    setScannedOtpSeed(null);
    setScannerState(PopupActionState.Start);
  }

  function handleManualOtpInputChange(e: any) {
    setManualOtpUrl((e.target as HTMLInputElement).value);
  }

  function handleTitleInput(e: Event) {
    if (e.target !== null) {
      setTitle((e.target as HTMLInputElement).value || null);
    }
  }

  function handleUrlInput(e: any) {
    if (e.target !== null) {
      setHasUrlError(false);
      setUrl((e.target as HTMLInputElement).value);
    }
  }

  function handleUrlBlur() {
    if (!url) {
      setHasUrlError(false);
      return;
    }

    // If provided an invalid URL (i.e.: cannot serialize using RFC3986)
    // then we display an error and prevent saving items.
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
      setHasUrlError(false);
    } catch {
      setHasUrlError(true);
    }
  }

  function handleUsernameInput(e: Event) {
    if (e.target !== null) {
      setUsername((e.target as HTMLInputElement).value);
    }
  }

  function handlePasswordInput(e: Event) {
    if (e.target !== null) {
      setPassword((e.target as HTMLInputElement).value);
    }
  }

  function handleNotesInput(e: Event) {
    if (e.target !== null) {
      setNotes((e.target as HTMLInputElement).value);
    }
  }

  function handleSave() {
    let otpSeed = scannedOtpSeed;
    if (manualOtpUrl.length > 0) {
      const s = parseOtpInput(manualOtpUrl);
      if (s !== null) {
        otpSeed = s;
      }
    }

    const updateLoginItem: CreateQuery<LoginItem> | UpdateQuery<LoginItem> = {
      id: props.vaultItem ? props.vaultItem.id : undefined!,
      name: title,
      url: props.isAutoSecureItem ? undefined : url,
      username,
      password,
      otpSeed,
      notes,
    };

    props.handleSave(updateLoginItem as any);
  }

  const formEnabled = scannerState != PopupActionState.Requested && props.networkBusy === false;

  const saveEnabled = formEnabled && password.length > 0;

  let content = (
    <div className={style.primaryContentContainer}>
      {/* Website URL & icon */}
      <div className={`${style.websiteUrlGroup} ${hasUrlError ? style.hasError : ""}`}>
        {/* Icon */}
        {vaultItem && (
          <div className={style.vaultItemEllipse}>
            <DynamicLogo fallback="images/manual_entry.svg" url={url} />
          </div>
        )}

        {/* PrimaryGroup but tweaked a bit for website url with icon */}
        <div className={style.websiteUrlContainer}>
          <div className={style.websiteUrlSub}>
            <div className={style.websiteUrlText1}>Website URL</div>
            <input
              className={style.websiteUrlInput}
              size={40}
              disabled={!formEnabled}
              required
              placeholder="www..."
              value={url}
              onChange={handleUrlInput}
              onBlur={handleUrlBlur}
            />
          </div>
        </div>
      </div>

      {/* Item name/title */}
      <div className={style.primaryContent}>
        <PrimaryGroup
          disabled={!formEnabled}
          label="Title"
          value={title ?? ""}
          placeholder="Choose a title for this login"
          change={handleTitleInput}
        />
      </div>

      {!!hasUrlError && <div className={style.websiteUrlErrorText}>You must enter a valid URL</div>}

      {/* User / pass / 2fa */}
      <div className={style.primaryContent}>
        <PrimaryGroup
          disabled={!formEnabled}
          label="Username"
          value={username}
          placeholder="Username"
          change={handleUsernameInput}
          {...E2E.TestTarget(E2E.TestID.LoginItemFormUsernameField)}
        />

        <PrimaryPasswordGroup
          label="Password"
          disabled={!formEnabled}
          value={password}
          placeholder="Password"
          change={handlePasswordInput}
          {...E2E.TestTarget(E2E.TestID.LoginItemFormPasswordField)}
        />
        <TwoFactorGroup
          disabled={!formEnabled}
          manualOtpInput={manualOtpUrl}
          handleManualOtpInputChange={handleManualOtpInputChange}
          otpSeed={scannedOtpSeed}
          scannerState={scannerState}
          handleScan={clickScan}
          clearScannedOtpSeed={clearScannedOtpSeed}
        />
      </div>

      {/* Notes */}
      <div className={style.primaryContent}>
        <TextareaGroup
          disabled={!formEnabled}
          change={handleNotesInput}
          label="Notes"
          value={notes}
          placeholder="Anything note-able to add?"
        />
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
      <div className={style.header} {...E2E.TestTarget(E2E.TestID.LoginItemFormRoot)}>
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
              {...E2E.TestTarget(E2E.TestID.LoginItemDeleteButton)}
            >
              <TrashButton />
            </button>
          )}

          <button
            disabled={!saveEnabled}
            className={saveEnabled ? style.saveButtonContainer : style.saveButtonContainerDisabled}
            onClick={saveEnabled ? handleSave : undefined}
            {...E2E.TestTarget(E2E.TestID.LoginItemFormSaveButton)}
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
