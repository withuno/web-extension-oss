export function sign(
  crypto: { subtle: { importKey: any; sign: any } },
  secret: ArrayBuffer,
  counter: number,
): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, true, ["sign"]).then((key: any) => {
    const bytes = new ArrayBuffer(8);
    const view = new DataView(bytes);

    // XXX: this code won't work after 2038
    // because it's not 64 bits.
    view.setUint32(4, counter, false);

    return crypto.subtle.sign("HMAC", key, bytes);
  });
}
