import { Fragment } from "react";

import { E2E } from "@/e2e";

import style from "./popup_add_edit.modules.css";
import { BackChevron, ConfirmDelete } from "./svgs";

export default function Delete(props: any) {
  function clickConfirm() {
    props
      .handleDelete(props.vaultItemId)
      .then(function () {
        props.handleDone();
      })
      .catch(function () {
        // XXX
      });
  }

  return (
    <>
      <div className={style.header}>
        <div className={style.headerDetails}>
          <button className={style.actionButton} onClick={props.handleClickBack}>
            <BackChevron />
          </button>
          <div className={style.headerDetailsDescription}>Confirm Delete</div>
        </div>
      </div>
      <div className={style.separator} />

      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div className={style.areYouSureOuter}>
          <div className={style.areYouSureInner}>
            <div className={style.areYouSureText1}>Are you sure you’d like to delete this item?</div>
            {props.isLogin && (
              <div className={style.areYouSureText2}>
                If you have 2 Factor Authentication on this account, disable it from the website first. Otherwise, you
                may lose access to your account.
              </div>
            )}
          </div>
        </div>
        <button
          className={style.confirmDeleteButton}
          disabled={props.networkBusy}
          onClick={clickConfirm}
          {...E2E.TestTarget(E2E.TestID.PopupConfirmDeleteButton)}
        >
          <ConfirmDelete />
          <div className={style.confirmDeleteButtonText}>DELETE</div>
        </button>
      </div>
    </>
  );
}
