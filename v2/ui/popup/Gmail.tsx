import React, { Fragment, useEffect, useState } from "react";

import { messageToJSON, messageFromJSON } from "@/v1/uno_types";

import style from "./popup_gmail.modules.css";
import { KeyIcon } from "./svgs";

export default function Gmail() {
  const [gmailScannerSetup, setGmailScannerSetup] = useState(false);

  function setupGmailScanner(interactive: boolean) {
    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "GET_AUTH_TOKEN",
        interactive,
      }),
      function (r) {
        if (r == undefined) return;
        const message = messageFromJSON(r);
        switch (message.kind) {
          case "GOOGLE_TOKEN_RESP":
            if (message && message.payload.gmailToken) {
              setGmailScannerSetup(true);
            }

            break;
        }
      },
    );
  }

  useEffect(() => {
    setupGmailScanner(false);

    return () => {};
  }, []);

  if (gmailScannerSetup) return <></>;

  return (
    <div className={style.gmailOuter}>
      <div className={style.gmailInner}>
        <div className={style.gmailTextContainer}>
          <div className={style.gmailTextInner}>
            <div className={style.gmailTextHeader}>
              <KeyIcon />
              <span className={style.gmailHeader}>Set up Peekaboo</span>
            </div>
            <span className={style.gmailHeaderText}>
              Uno shows login codes, links, and password reset emails right in your browser tab — no more opening your
              inbox and spamming refresh to find them!
            </span>
          </div>
        </div>
        <div className={style.gmailBtnContainer}>
          <button onClick={() => setupGmailScanner(true)} className={style.gmailBtn}>
            <div className={style.gmailBtnTextContainer}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_4967_78865)">
                  <path
                    d="M11.28 6.125C11.28 5.735 11.245 5.36 11.18 5H6V7.13H8.96C8.83 7.815 8.44 8.395 7.855 8.785V10.17H9.64C10.68 9.21 11.28 7.8 11.28 6.125Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M5.99984 11.5008C7.48484 11.5008 8.72985 11.0108 9.63984 10.1708L7.85484 8.78578C7.36484 9.11578 6.73984 9.31578 5.99984 9.31578C4.56984 9.31578 3.35484 8.35078 2.91984 7.05078H1.08984V8.47078C1.99484 10.2658 3.84984 11.5008 5.99984 11.5008Z"
                    fill="#34A853"
                  />
                  <path
                    d="M2.92 7.04516C2.81 6.71516 2.745 6.36516 2.745 6.00016C2.745 5.63516 2.81 5.28516 2.92 4.95516V3.53516H1.09C0.715 4.27516 0.5 5.11016 0.5 6.00016C0.5 6.89016 0.715 7.72516 1.09 8.46516L2.515 7.35516L2.92 7.04516Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M5.99984 2.69C6.80984 2.69 7.52984 2.97 8.10484 3.51L9.67984 1.935C8.72484 1.045 7.48484 0.5 5.99984 0.5C3.84984 0.5 1.99484 1.735 1.08984 3.535L2.91984 4.955C3.35484 3.655 4.56984 2.69 5.99984 2.69Z"
                    fill="#EA4335"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_4967_78865">
                    <rect width="12" height="12" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span className={style.gmailText}>SIGN IN WITH GOOGLE</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
