import React, { useEffect, useMemo, useState } from "react";

import { messageFromJSON, messageToJSON } from "@/v1/uno_types";
import { ToggleCommandMenu } from "@/v2/actions/command-menu/toggle-command-menu.action";
import { OpenPasswordGenerator } from "@/v2/actions/password-generator/open-password-generator.action";
import { useUnoOrchestrator } from "@/v2/orchestrator/react";

import style from "./popup_settings.modules.css";
import { BackChevron, DiscordLogo, RefreshIcon, RightChevron, TwitterLogo } from "./svgs";

const env_name = process.env.ENV_NAME;
const git_commit_hash = process.env.GIT_COMMIT_HASH;
const git_branch = process.env.GIT_BRANCH;
const git_status = process.env.GIT_STATUS;

export default function Settings(props: any) {
  function handleClickRefresh() {
    props.handleRefresh();
  }

  const manifest = useMemo(() => {
    return chrome.runtime.getManifest();
  }, []);

  const [gmailScannerSetup, setGmailScannerSetup] = useState(false);
  function setupGmailScanner(interactive: boolean) {
    chrome.runtime.sendMessage(
      messageToJSON({
        kind: "GET_AUTH_TOKEN",
        interactive,
      }),
      (r) => {
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
  }, []);

  const { orchestrator } = useUnoOrchestrator();

  return (
    <>
      <div className={style.header}>
        <div className={style.headerDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>
          <div className={style.headerDetailsDescription}>Settings</div>
        </div>
        <div className={style.btnGroup2}>
          <button
            onClick={() => {
              window.location = "mailto:support@uno.app?subject=Need support with Uno" as (string | Location) &
                Location;
            }}
            className={style.btn1Outer}
          >
            <div className={style.btn1Inner}>
              <span className={style.btn1Text}>Get Support</span>
            </div>
          </button>
          <button
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              handleClickRefresh();

              return false;
            }}
            className={style.btn2Outer}
          >
            <RefreshIcon />
          </button>
        </div>
      </div>
      <div className={style.separator} />
      <div className={style.socialsContainer}>
        <button
          onClick={() => {
            chrome.tabs.create({
              active: true,
              url: "https://discord.gg/unoidentity",
            });
          }}
          className={style.discordBtn}
        >
          <DiscordLogo />
          <div className={style.discordTextContainer}>
            <span className={style.discordText}>Join us on Discord</span>
          </div>
        </button>
        <button
          onClick={() => {
            chrome.tabs.create({
              active: true,
              url: "https://twitter.com/unoidentity",
            });
          }}
          className={style.twitterBtn}
        >
          <TwitterLogo />
          <div className={style.twitterTextContainer}>
            <span className={style.twitterText}>Follow on twitter</span>
          </div>
        </button>
      </div>
      {/* AI Assist */}
      <button
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          props.handleClickAiAssistSettings();
          return false;
        }}
        className={style.settingItem}
      >
        <span className={style.settingItemText}>AI Assist (Preview)</span>
        <RightChevron />
      </button>
      {/* Open Command Menu */}
      <button
        onClick={() => {
          orchestrator.useAction(ToggleCommandMenu)({
            behavior: "open",
            showShortcutBanner: true,
          });
          window.close();
        }}
        className={style.settingItem}
      >
        <span className={style.settingItemText}>Open command menu</span>
        <RightChevron />
      </button>
      {/* Open Suggest Password */}
      <button
        onClick={() => {
          orchestrator.useAction(OpenPasswordGenerator)();
          window.close();
        }}
        className={style.settingItem}
      >
        <span className={style.settingItemText}>Generate Strong Password</span>
        <RightChevron />
      </button>
      {/* Setup/Disconnect Gmail Scanner */}
      {gmailScannerSetup ? (
        <button
          onClick={() => {
            chrome.runtime.sendMessage(messageToJSON({ kind: "TURN_OFF_GMAIL_SCANNER" }), function () {
              window.close();
            });
          }}
          className={style.settingItem}
        >
          <span className={style.settingItemText}>Disconnect Peekaboo</span>
          <RightChevron />
        </button>
      ) : (
        <button
          onClick={() => {
            setupGmailScanner(true);
            window.close();
          }}
          className={style.settingItem}
        >
          <span className={style.settingItemText}>Set up Peekaboo</span>
          <RightChevron />
        </button>
      )}
      {/* Add device */}
      <button
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          props.handleClickAddDevice();
          return false;
        }}
        className={style.settingItem}
      >
        <span className={style.settingItemText}>Add another device</span>
        <RightChevron />
      </button>
      <button
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          props.handleClickViewSeed();

          return false;
        }}
        className={style.settingItem}
      >
        <span className={style.settingItemText}>View private key</span>
        <RightChevron />
      </button>
      <button
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          props.handleClickLogout();

          return false;
        }}
        className={style.settingItem}
      >
        <span style={{ color: "#FC511F" }} className={style.settingItemText}>
          Log out
        </span>
        <RightChevron />
      </button>

      <div className={style.buildinfoContainer}>
        <div>
          v{manifest.version}-{git_commit_hash}
          {git_status && env_name !== "production" ? `-${git_status}` : ""} ({env_name})
        </div>
        {env_name !== "production" && <div>{git_branch}</div>}
      </div>
      {env_name !== "production" && (
        <div
          className={style.debugViewVault}
          onClick={function () {
            chrome.tabs.create({
              url: chrome.extension.getURL("debug-view-vault.html"),
            });
          }}
        >
          debug view vault
        </div>
      )}
    </>
  );
}
