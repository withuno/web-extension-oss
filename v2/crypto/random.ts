import { Charsets } from "./crypto.types";

/**
 * Generates a cryptographically-random
 * string using native browser Crypto APIs.
 */
export function createRandomString(size: number, charset = Charsets.Alphanumeric) {
  const bytes = createRandomBytes(size);
  return bytesToString(bytes, charset);
}

/**
 * Generates a cryptographically-random `Uint8Array`
 * byte-array using native browser Crypto APIs.
 */
export function createRandomBytes(size: number) {
  const bytes = new Uint8Array(size);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Generates a Base64-encoded cryptographic seed which
 * serves as the private key for a new Uno Vault.
 */
export function createVaultSeed() {
  const newSeed = createRandomBytes(32);

  let result = "";
  for (let i = 0; i < 32; i++) {
    result += String.fromCharCode(newSeed[i]);
  }

  return window.btoa(result);
}

/**
 * Stringifies `bytes` using characters provided in `charset`.
 */
function bytesToString(bytes: Uint8Array, charset: string) {
  return Array.from(bytes)
    .map((value: number) => charset[value % charset.length])
    .join("");
}
