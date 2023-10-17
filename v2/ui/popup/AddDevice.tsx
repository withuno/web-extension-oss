import React, { useEffect, useState, Fragment } from "react";

import QR from "@/v1/QR";
import { messageToJSON, messageFromJSON } from "@/v1/uno_types";

import style from "./popup_add_device.modules.css";
import { BackChevron, QRIcon } from "./svgs";

export default function AddDevice(props: any) {
  const [seedPhrase, setSeedPhrase] = useState<string | undefined>(undefined);
  const [copyBtnText, setCopyBtnText] = useState("Copy");

  useEffect(function () {
    chrome.runtime.sendMessage(messageToJSON({ kind: "SHARE_SEED" }), function (r) {
      try {
        const message = messageFromJSON(r);

        switch (message.kind) {
          case "SESSION_CREATED":
            setSeedPhrase(message.payload);
            break;
          default:
            break;
        }
      } catch {}
    });
  }, []);

  return (
    <>
      <div className={style.header}>
        <div className={style.headerDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>
          <div className={style.headerDetailsDescription}>Add Another Device</div>
        </div>
      </div>
      <div className={style.separator} />
      <div style={{ paddingLeft: "16px", paddingTop: "16px" }}>
        <div className={style.otherDeviceContainer}>
          <div className={style.otherHeader}>
            <QRIcon />
            <div className={style.otherTextContainer}>
              <span className={style.otherText}>Scan the QR code using the Uno iOS app</span>
            </div>
          </div>

          <div className={style.otherDetailsContainer}>
            <div className={style.otherDetailsText}>
              <span>
                1. Get Uno for{" "}
                <span
                  style={{ textDecoration: "underline", cursor: "pointer" }}
                  onClick={() => {
                    chrome.tabs.create({
                      active: true,
                      url: "itms-apps://itunes.apple.com/app/id1584884476",
                    });
                  }}
                >
                  iOS
                </span>{" "}
                or{" "}
                <span
                  style={{
                    textDecoration: "underline",
                    cursor: "pointer",
                    marginLeft: "12px",
                  }}
                  onClick={() => {
                    chrome.tabs.create({
                      active: true,
                      url: "itms-apps://itunes.apple.com/app/id1584884476",
                    });
                  }}
                >
                  MacOS.
                </span>
                <br />
                2. Tap Sign in.
                <br />
                3. Select Scan QR Code.
              </span>
            </div>
            {seedPhrase && (
              <div className={style.otherDetailsImg}>
                <QR data={seedPhrase} onError={() => {}} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ paddingLeft: "16px", paddingTop: "16px" }}>
        <div className={style.getUnoContainer}>
          <div className={style.getUnoHeader}>
            <QRIcon />

            <div className={style.headerTextContainer}>
              <span className={style.headerText}>Enter your private key on the other device</span>
            </div>
          </div>

          <div className={style.addPkDescriptionContainer}>
            <div className={style.otherDetailsText}>
              <span>
                1. Get Uno for{" "}
                <span
                  style={{ textDecoration: "underline", cursor: "pointer" }}
                  onClick={() => {
                    chrome.tabs.create({
                      active: true,
                      url: "itms-apps://itunes.apple.com/app/id1584884476",
                    });
                  }}
                >
                  iOS
                </span>{" "}
                or{" "}
                <span
                  style={{
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    chrome.tabs.create({
                      active: true,
                      url: "itms-apps://itunes.apple.com/app/id1584884476",
                    });
                  }}
                >
                  MacOS.
                </span>
                <br />
                2. Tap Sign in.
                <br />
                3. Tap Enter Private Key.
                <br /> 4. Enter the private key below. DO NOT share this{" "}
                <span style={{ marginLeft: "16px" }}>key with anyone ever.</span>
              </span>
            </div>
          </div>

          {seedPhrase && (
            <div className={style.copyPkContainer}>
              <div className={style.blurPkOuter}>
                <div className={style.blurPkInner}>
                  <span className={style.blurPkText}>{seedPhrase}</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  setCopyBtnText("Copied");
                  await navigator.clipboard.writeText(seedPhrase);
                  setTimeout(() => {
                    setCopyBtnText("Copy");
                  }, 1000);
                }}
                className={style.copyBtn}
              >
                <div className={style.copyBtnInner}>
                  <span className={style.copyBtnText}>{copyBtnText}</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
