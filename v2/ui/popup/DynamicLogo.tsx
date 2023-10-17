import React, { useState, useEffect } from "react";

import { LogoService } from "@/v1/service/logo_service";

import style from "./popup_index.modules.css";

const DEFAULT_LOGO_SIZE = 32;
const DEFAULT_LOGO_FORMAT = "png";

export default function DynamicLogo(props: { fallback: string; url: string | undefined }) {
  // eslint-disable-next-line
  const logoService = new LogoService(process.env.API_SERVER);

  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);

  useEffect(function () {
    if (props.url !== undefined) {
      let domain;
      try {
        const url = new URL(props.url);
        domain = url.hostname;
      } catch (e) {
        domain = props.url;
      }

      logoService.logoFromDomain(domain, DEFAULT_LOGO_FORMAT).then(function (buf) {
        if (buf.length > 0) {
          const blob = new Blob([buf]);
          const objectUrl = URL.createObjectURL(blob);
          setImageObjectUrl(objectUrl);
        }
      });
    }

    return () => {
      if (imageObjectUrl !== null) {
        URL.revokeObjectURL(imageObjectUrl);
      }
    };
  }, []);

  if (imageObjectUrl !== null) {
    return <img className={style.dynamicLogo} src={imageObjectUrl} />;
  }
  return <img src={props.fallback} />;
}
