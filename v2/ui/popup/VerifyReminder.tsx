import React from "react";

import style from "./popup_verify.modules.css";

export default function VerifyReminder(props: any) {
  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyInner1}>
        <div className={style.verifyInner2}>
          <div className={style.verifyTextContainer}>
            <div className={style.verifyText1}>Verify your email</div>
            <div className={style.verifyText2}>Please click the link in the verification email.</div>
          </div>
          <form onSubmit={props.handleVerifySubmit} className={style.verifyForm}>
            <div className={style.reverifyButton}>
              <button type="submit" aria-required>
                <span className={style.reverifyButtonText}>Resend Email</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
