import React, { Fragment } from "react";

import style from "./popup_add_device.modules.css";
import { BackChevron, KeyIcon, PeopleIcon } from "./svgs";

export default function Logout(props: any) {
  return (
    <>
      <div className={style.header}>
        <div className={style.headerDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>
          <div className={style.headerDetailsDescription}>Confirm Log out</div>
        </div>
      </div>
      <div className={style.separator} />

      <div className={style.logOuter}>
        <div className={style.logInner}>
          <span className={style.logHeader}>Before logging out, confirm:</span>
          <div className={style.logTextContainer}>
            <PeopleIcon />
            <div className={style.logTextContainerInner}>
              <span className={style.logTextContainerHeader}>Trusted Contacts are set up</span>
              <span className={style.logTextContainerContent}>
                Uno accounts don’t use passwords to login. Setup Trusted Contacts — people who can securely help you log
                back into your Uno account.
                <br />
                <br /> Add Trusted Contacts through the{" "}
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    window.open("https://apps.apple.com/us/app/uno-identity/id1584884476");
                  }}
                  href="itms-apps://itunes.apple.com/app/id1584884476"
                >
                  Uno iOS app
                </a>
                .
              </span>
            </div>
          </div>
          <div className={style.logTextContainer}>
            <KeyIcon />
            <div className={style.logTextContainerInner}>
              <span className={style.logTextContainerHeader}>Private key is saved somewhere safe</span>
              <span className={style.logTextContainerContent}>We also recommend writing down your private key.</span>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={() => {
          props.handleClickConfirmLogout();
        }}
        className={style.logoutBtn}
      >
        <span className={style.logoutBtnText}>Confirm Log Out</span>
      </button>
    </>
  );
}
