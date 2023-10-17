import React from "react";

import style from "./popup_verify.modules.css";

export default function Verify(props: any) {
  return (
    <div className={style.verifyContainer}>
      <div className={style.verifyInner1}>
        <div className={style.verifyInner2}>
          <div className={style.verifyTextContainer}>
            <div className={style.verifyText1}>Verify your email</div>
            <div className={style.verifyText2}>
              To prevent spam, please verify your email. A confirmation link will be sent to your inbox.
            </div>
          </div>
          <form className={style.verifyForm} onSubmit={props.handleVerifySubmit}>
            <input className={style.verifyInput} type="email" name="email" required placeholder="What's your email?" />
            <div>
              <button aria-required className={style.verifyButton} type="submit">
                <div className={style.verifyButtonInner}>
                  <span className={style.verifyButtonText}>SUBMIT</span>
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
