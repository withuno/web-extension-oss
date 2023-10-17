import { Base64URL } from "../utils/base64";

/**
 * Produces a SHA-256 hash of the given `message`.
 */
export async function sha256(message: string) {
  const bytes = new TextEncoder().encode(message);
  return crypto.subtle.digest("SHA-256", bytes).then(base64URLEncodeFromByteArray);
}

/**
 * Stringifies the given `ArrayBuffer`, then encodes to a Base64URL string.
 */
function base64URLEncodeFromByteArray(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const utf8Binary = Array.from(bytes)
    .map((value) => String.fromCharCode(value))
    .join("");
  return Base64URL.encode(utf8Binary);
}
