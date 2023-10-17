import React from "react";

import QRCode from "qrcode";

function QR(props: { data: string; onError: (e: any) => void }) {
  let qr = "";

  QRCode.toDataURL(
    props.data,
    {
      errorCorrectionLevel: "M",
      width: 200,
    },
    function (error: any, url: string) {
      if (error !== null) {
        return props.onError(error);
      }

      qr = url;
    },
  );

  return (
    <div className="onboard-qr">
      <img src={qr} id="canvas" />
    </div>
  );
}

export default QR;
