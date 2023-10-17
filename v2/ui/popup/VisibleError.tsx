import React, { Fragment } from "react";

import style from "./popup.modules.css";

export default function (props: any) {
  return (
    <>
      <div className={style.errorContainer}>
        <div className={style.errorMessage}>{props.message}</div>
      </div>
    </>
  );
}
