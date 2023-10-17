export async function hmac(secret: ArrayBuffer, counter: number) {
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, true, ["sign"]).then((key) => {
    const bytes = new ArrayBuffer(8);
    const view = new DataView(bytes);

    // Note: this code won't work after 2038 because it's not 64 bits.
    view.setUint32(4, counter, false);

    return crypto.subtle.sign("HMAC", key, bytes);
  });
}
