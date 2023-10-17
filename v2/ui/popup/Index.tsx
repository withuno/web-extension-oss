import React, { useState, Fragment, useCallback, useRef } from "react";

import { useClickOutside } from "usable-react";

import { E2E } from "@/e2e";
import Logo from "@/v1/Logo";
import {
  messageToJSON,
  VisibleVaultItem,
  VaultSuccess,
  VerifiedStatus,
  SchemaType,
  VisibleVaultItemBySchemaType,
} from "@/v1/uno_types";

import DynamicLogo from "./DynamicLogo";
import Gmail from "./Gmail";
import style from "./popup_index.modules.css";
import SearchIcon from "./SearchIcon";
import { AddItemIcon, FeedbackIcon, SettingsIcon } from "./svgs";
import Verify from "./Verify";
import VerifyReminder from "./VerifyReminder";

function filterVault(vault: VaultSuccess, value: string) {
  if (value.length === 0) {
    return vault;
  }

  const re = new RegExp(`${value}`);
  const v = vault.filter(function (v) {
    const itemName = (v as VisibleVaultItemBySchemaType<"login" | "credit_card" | "private_key">).name?.toLowerCase();
    if (itemName && re.test(itemName)) {
      return true;
    }

    const itemTitle = (v as VisibleVaultItemBySchemaType<"secure_note">).title?.toLowerCase();
    if (itemTitle && re.test(itemTitle)) {
      return true;
    }

    const addressLine1 = (v as VisibleVaultItemBySchemaType<"address">).line1?.toLowerCase();
    if (addressLine1 && re.test(addressLine1)) {
      return true;
    }

    if (
      v.schema_type === "login" &&
      v.matching_hosts.find(function (m) {
        if (re.test(m)) return true;
        return false;
      }) !== undefined
    ) {
      return true;
    }

    return false;
  });

  return v;
}

export default function Index(props: any) {
  const [filteredVault, setFilteredVault]: [VaultSuccess | undefined, any] = useState(props.vault);
  const [filterValue, setFilterValue] = useState("");
  const [vaultEmail, setVaultEmail] = useState("");

  // eslint-disable-next-line react/no-unstable-nested-components
  function NoMatch(props: any) {
    return (
      <>
        {filterValue !== "" && (
          <button
            className={style.showAllItems}
            onClick={() => {
              updateFilter("");
            }}
          >
            <svg
              className={style.showAllItemsImg}
              width="8"
              height="12"
              viewBox="0 0 8 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0.679688 5.76953C0.679688 5.91406 0.707031 6.04883 0.761719 6.17383C0.816406 6.29492 0.904297 6.41406 1.02539 6.53125L5.45508 10.8672C5.63477 11.0469 5.85156 11.1367 6.10547 11.1367C6.27734 11.1367 6.43359 11.0938 6.57422 11.0078C6.71875 10.9258 6.83398 10.8145 6.91992 10.6738C7.00586 10.5332 7.04883 10.377 7.04883 10.2051C7.04883 9.94727 6.94727 9.7168 6.74414 9.51367L2.88281 5.76367L6.74414 2.01953C6.94727 1.82422 7.04883 1.5957 7.04883 1.33398C7.04883 1.16211 7.00586 1.00586 6.91992 0.865234C6.83398 0.724609 6.71875 0.613281 6.57422 0.53125C6.43359 0.445312 6.27734 0.402344 6.10547 0.402344C5.85156 0.402344 5.63477 0.490234 5.45508 0.666016L1.02539 5.00195C0.908203 5.11914 0.822266 5.24023 0.767578 5.36523C0.712891 5.48633 0.683594 5.62109 0.679688 5.76953Z"
                fill="#C6C8CC"
              />
            </svg>
            <div className={style.showAllItemsText}>Show all items</div>
          </button>
        )}

        <div className={style.noMatchCentered}>
          <img src="images/no_matches.svg" />
          {filterValue.length ? (
            <>
              <div className={style.noMatchBoldText}>No items saved for</div>
              <div className={style.noMatchGreyText}>{filterValue}</div>
            </>
          ) : (
            <div className={style.noMatchBoldText}>No items saved</div>
          )}

          <AddItemPopover
            placement="top"
            triggerSlot={
              <button onClick={props.handleClickAdd} className={style.noMatchButtonOuter}>
                ADD NEW ITEM
              </button>
            }
            handleClickAdd={props.handleClickAdd}
          />
        </div>
      </>
    );
  }

  function handleFilterInput(e: any) {
    const target = e.target as HTMLInputElement;
    updateFilter(target.value);
  }

  function updateFilter(newValue: string) {
    if (props.vault === undefined) {
      return;
    }

    setFilterValue(newValue);

    if (newValue.length === 0) {
      return setFilteredVault(props.vault);
    }

    return setFilteredVault(filterVault(props.vault, newValue));
  }

  function showFeedbackModal() {
    window.close();

    chrome.runtime.sendMessage(messageToJSON({ kind: "SHOW_FEEDBACK_FROM_POPUP" }), function (r) {});
  }

  let content = <></>;

  if (props.networkBusy) {
    content = (
      <>
        <div className={style.spinnerContainer}>
          <img className={style.spinner} src="../images/popup_spinner.svg" />
        </div>
      </>
    );
  }

  if (props.vault !== undefined) {
    const filteredVault = filterVault(props.vault, filterValue);

    if (filteredVault.length === 0) {
      content = <NoMatch {...props} />;
    } else {
      const v = filteredVault
        .sort(function (a: VisibleVaultItem, b: VisibleVaultItem) {
          const sortableSchemas = ["login", "credit_card", "private_key", "secure_note"] as const;

          if (sortableSchemas.includes(a.schema_type as any) || sortableSchemas.includes(b.schema_type as any)) {
            const getSortableField = (item: VisibleVaultItem): string | undefined => {
              return (item as any).name || (item as any).title;
            };

            if (!getSortableField(a) || !getSortableField(b)) {
              return 0;
            }

            return getSortableField(a)!.toLowerCase() < getSortableField(b)!.toLowerCase() ? -1 : 1;
          }

          return 0;
        })
        .map((m: VisibleVaultItem) => {
          // Don't show sso provider vault items
          let showItem = true;
          if (m.schema_type === "login") {
            if (m.ssoProvider && m.ssoProvider.length > 0) {
              showItem = false;
            }
          }

          const fallbackImgBySchemaType: Record<SchemaType, string> = {
            login: "images/manual_entry.svg",
            credit_card: "images/creditcard_sm.svg",
            address: "images/map.svg",
            private_key: "images/manual_entry.svg",
            secure_note: "images/note_sm.svg",
          };

          let logo_img;

          if (m.schema_type === "login") {
            logo_img = <DynamicLogo fallback={fallbackImgBySchemaType.login} url={m.url} />;
          } else {
            logo_img = (
              <img
                className={`${style.vaultItemLogo} ${style[m.schema_type]}`}
                onLoad={function (e) {
                  if (m.inset_x !== undefined) {
                    (e.target as HTMLElement).style.width = `${(e.target as HTMLElement).offsetWidth - m.inset_x}px`;
                  }

                  if (m.inset_y !== undefined) {
                    (e.target as HTMLElement).style.height = `${(e.target as HTMLElement).offsetHeight - m.inset_y}px`;
                  }
                }}
                src={m.logo_name ? `images/${m.logo_name}.svg` : fallbackImgBySchemaType[m.schema_type]}
                onError={function (e) {
                  (e.target as HTMLImageElement).src = m.fallback_img
                    ? m.fallback_img
                    : fallbackImgBySchemaType[m.schema_type];
                }}
              />
            );
          }

          // XXX: clicking to highlight your username triggers the click action
          // which is annoying.
          return (
            showItem && (
              <button
                onClick={() => {
                  props.handleClickItem(m);
                }}
                key={m.id}
                className={style.vaultItemContainer}
                {...E2E.TestTarget(m.id)}
              >
                <div
                  className={style.vaultItemEllipse}
                  style={{
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {logo_img}
                </div>
                <div className={style.vaultItemPrimaryContainer}>
                  <div className={style.serviceNameLabel}>
                    {(m as VisibleVaultItemBySchemaType<"login" | "credit_card" | "private_key">).name ||
                      (m as VisibleVaultItemBySchemaType<"secure_note">).title ||
                      (m as VisibleVaultItemBySchemaType<"address">).line1}
                  </div>
                  {m.schema_type === "login" && <div className={style.serviceNameValue}>{m.username}</div>}
                </div>
                <div className={style.showTarget}>
                  <img src="images/chevron.svg" />
                </div>
              </button>
            )
          );
        });

      content = <>{v}</>;
    }
  }

  const cards = (
    <>
      {props.verifiedStatus == VerifiedStatus.NotEmailed && filterValue === "" && (
        <Verify handleVerifySubmit={props.handleVerifySubmit} />
      )}

      {props.verifiedStatus == VerifiedStatus.EmailedNotVerified && filterValue === "" && (
        <VerifyReminder
          handleVerifySubmit={(e: any) => {
            e.preventDefault();
            props.handleReVerifySubmit(vaultEmail);
            return false;
          }}
        />
      )}
      <Gmail />
    </>
  );

  return (
    <>
      <div className={style.header}>
        <div className={style.logoContainer}>
          <Logo />
        </div>
        <div className={style.searchContainer}>
          <SearchIcon />
          <input className={style.searchBar} placeholder="Search" value={filterValue} onChange={handleFilterInput} />
        </div>

        <div className={style.actionsContainer}>
          <button onClick={showFeedbackModal} className={`${style.actionButton} ${style.feedback}`}>
            <FeedbackIcon />
          </button>

          <AddItemPopover
            placement="bottom"
            triggerSlot={
              <button className={style.actionButton} {...E2E.TestTarget(E2E.TestID.PopupIndexAddVaultItemButton)}>
                <AddItemIcon />
              </button>
            }
            handleClickAdd={props.handleClickAdd}
          />

          <button onClick={props.handleClickSettings} className={style.actionButton}>
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div className={style.separator} />

      {cards}

      {content}
    </>
  );
}

interface AddItemPopoverProps {
  placement?: "top" | "bottom";
  triggerSlot: JSX.Element;
  handleClickAdd: (schemaType: SchemaType) => void;
}

function AddItemPopover(props: AddItemPopoverProps) {
  const { placement = "top", triggerSlot, handleClickAdd } = props;

  const [isOpen, setIsOpen] = useState(false);

  const togglePopoverMenu = useCallback(() => {
    setIsOpen((currIsOpen) => !currIsOpen);
  }, []);

  const popoverContainerRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(popoverContainerRef, () => {
    setIsOpen(false);
  });

  return (
    <div className={style.popoverContainer} ref={popoverContainerRef}>
      {React.cloneElement(triggerSlot, { onClick: togglePopoverMenu })}

      {isOpen && (
        <div className={`${style.popoverMenu} ${style[placement]}`}>
          <div className={style.popoverMenuContent}>
            {/* Add login item */}
            <AddItemPopoverActionButton
              schemaType="login"
              title="Add a custom login"
              description="Save a login for any website. Uno can use it to Magic Login for you on the desktop."
              iconSrc="images/add_login_item_icon.svg"
              handleClickAdd={handleClickAdd}
              {...E2E.TestTarget(E2E.TestID.PopupIndexAddLoginItemButton)}
            />

            {/* Add a private key */}
            <AddItemPopoverActionButton
              schemaType="private_key"
              title="Add a private key"
              description="Secure your secret recovery phrases, private keys, recovery seeds and more with Uno."
              iconSrc="images/add_private_key_item_icon.svg"
              handleClickAdd={handleClickAdd}
            />

            {/* Add a secure note */}
            <AddItemPopoverActionButton
              schemaType="secure_note"
              title="Add secure note"
              description="Save anything note-able"
              iconSrc="images/add_secure_note_item_icon.svg"
              handleClickAdd={handleClickAdd}
            />

            {/* Add credit card item */}
            <AddItemPopoverActionButton
              schemaType="credit_card"
              title="Add a credit card"
              description="Secure your credit cards so Uno can AutoFill them for you on the desktop."
              iconSrc="images/add_credit_card_item_icon.svg"
              handleClickAdd={handleClickAdd}
            />

            {/* Add address item */}
            <AddItemPopoverActionButton
              schemaType="address"
              title="Add an address"
              description="Save your addresses so Uno can AutoFill them for you on the desktop."
              iconSrc="images/add_address_item_icon.svg"
              handleClickAdd={handleClickAdd}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface AddItemPopoverActionButtonProps extends Pick<AddItemPopoverProps, "handleClickAdd">, E2E.TestTarget {
  schemaType: SchemaType;
  title: React.ReactNode;
  description: React.ReactNode;
  iconSrc: string;
}

function AddItemPopoverActionButton(props: AddItemPopoverActionButtonProps) {
  const { handleClickAdd, schemaType, title, description, iconSrc } = props;

  const handleClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      e.preventDefault();
      handleClickAdd(schemaType);
    },
    [schemaType],
  );

  return (
    <button className={style.popoverActionButton} onClick={handleClick} {...E2E.TestTarget(props)}>
      <img className={style.popoverActionButtonImg} src={iconSrc} />
      <div className={style.popoverActionButtonTextContent}>
        <span className={style.popoverActionButtonTextContentBold}>{title}</span>
        <span>{description}</span>
      </div>
    </button>
  );
}
