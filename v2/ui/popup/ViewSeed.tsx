import React, { useEffect, useState, Fragment } from "react";

import { messageToJSON, messageFromJSON } from "@/v1/uno_types";

import style from "./popup_add_edit.modules.css";
import { BackChevron } from "./svgs";

export default function ViewSeed(props: any) {
  const [seedPhrase, setSeedPhrase] = useState<string | undefined>(undefined);

  useEffect(function () {
    chrome.runtime.sendMessage(messageToJSON({ kind: "SHARE_SEED" }), function (r) {
      try {
        const message = messageFromJSON(r);

        switch (message.kind) {
          case "SESSION_CREATED":
            setSeedPhrase(message.payload);
            break;
          default:
            break; // ?
        }
      } catch {
        // ?
      }
    });
  }, []);

  if (seedPhrase !== undefined) {
    return (
      <>
        <div className={style.header}>
          <div className={style.headerDetails}>
            <button className={style.actionButton} onClick={props.handleClickBack}>
              <BackChevron />
            </button>
            <div className={style.headerDetailsDescription}>Private Key</div>
          </div>
        </div>
        <div className={style.separator} />

        <div className={style.primaryContentContainer}>
          <div className={style.dontShareContainer}>
            <div className={style.dontShareHeader}>
              <span className={style.dontShareHeaderText}>DO NOT SHARE YOUR PRIVATE KEY</span>
            </div>
            <span className={style.dontShareHeaderText1}>
              If someone has your private key, they will have access to your Uno account.
            </span>
          </div>
          <div className={style.pkeyContainer}>
            <div className={style.pkeyInner}>{seedPhrase && <div className={style.pkey}>{seedPhrase}</div>}</div>
          </div>
        </div>
      </>
    );
  }

  return <div>...</div>;
}
