import jsQR from "jsqr";

import { messageToJSON } from "../uno_types";

(function () {
  const matches = document.getElementsByTagName("img");
  return Promise.all(
    Array.from(matches).map(function (el) {
      return new Promise(function (resolve) {
        const pageImage = el;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.addEventListener("error", function () {
          resolve(null);
        });
        img.addEventListener("load", function (e) {
          const m = e.target as HTMLImageElement;
          const offscreen = new OffscreenCanvas(m.width, m.height);
          const ctx = offscreen.getContext("2d");
          if (ctx == null) return;

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, m.width, m.height);

          return resolve(jsQR(imageData.data, m.width, m.height));
        });

        img.src = pageImage.src;
      });
    }),
  )
    .then(function (codes: any) {
      // XXX: fix 'anys'
      const found = codes.find(function (c: any) {
        try {
          const url = new URL(c.data);
          if (url.protocol == "otpauth:") {
            return true;
          }

          return false;
        } catch (_) {
          return false;
        }
      });

      if (found === undefined) {
        return null;
      }

      return found.data;
    })
    .then(function (result: string | null) {
      if (result === null) {
        return chrome.runtime.sendMessage(messageToJSON({ kind: "NO_QR_FOUND" }));
      }

      return chrome.runtime.sendMessage(messageToJSON({ kind: "FOUND_QR", payload: result }));
    });
})();
