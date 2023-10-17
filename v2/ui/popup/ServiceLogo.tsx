import React from "react";

import style from "./popup_show.modules.css";

export default function ServiceLogo(props: any) {
  const item = props.vaultItem;
  return (
    <img
      className={style.vaultItemLogo}
      onLoad={function (e) {
        if (item && item.inset_x !== undefined) {
          (e.target as HTMLElement).style.width = `${(e.target as HTMLElement).offsetWidth - item.inset_x}px`;
        }

        if (item && item.inset_y !== undefined) {
          (e.target as HTMLElement).style.height = `${(e.target as HTMLElement).offsetHeight - item.inset_y}px`;
        }
      }}
      src={item && item.logo_name ? `images/${item.logo_name}.svg` : `images/manual_entry.svg`}
      onError={function (e) {
        (e.target as HTMLImageElement).src = item.fallback_img ? item.fallback_img : `images/manual_entry.svg`;
      }}
    />
  );
}
