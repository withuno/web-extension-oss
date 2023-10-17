import { hmac } from "./hmac";
import { sleep } from "../utils/async";
import { base32ToBase64 } from "../utils/base32";

/**
 * @see https://tools.ietf.org/html/rfc6238
 */
export function totp(secret: ArrayBuffer, seconds: number): Promise<string> {
  const counter = Math.floor(seconds / 30);
  return hotp(secret, counter).then((h) => {
    return h.toString().padStart(6, "0");
  });
}

/**
 * @see https://tools.ietf.org/html/rfc4226#section-5.4
 */
export function hotp(secret: ArrayBuffer, counter: number): Promise<number> {
  return hmac(secret, counter).then((sig) => {
    const buf = new Uint8Array(sig);

    const offset = buf[19] & 0xf;
    // mask 32nd bit
    buf[offset] &= 0x7f;

    const view = new DataView(sig);
    const dbc = view.getUint32(offset, false);

    return dbc % 1000000;
  });
}

/**
 * @returns a Promise which resolves after `threshold` milliseconds if the TOTP
 * code is at the edge of rolling over.
 */
export async function totpRolloverEdge(threshold = 3000) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const edge = Math.floor((Date.now() + threshold) / 1000 / 30);
  if (edge != counter) {
    await sleep(threshold);
  }
}

// match TOTP urls
const OTP_URL_REGEX = /^otpauth:\/\/totp\/.+/i;

// match any base32 string
const OTP_SECRET_REGEX = /^[A-Z2-7=]+$/;

/**
 * Recover a valid OTP seed from user input
 */
export function parseOtpInput(possible: string): string | null {
  const s = possible.trim();

  if (s.match(OTP_URL_REGEX)) {
    return base64SeedFromOtpUrl(s);
  }

  if (s.match(OTP_SECRET_REGEX)) {
    try {
      return base32ToBase64(s);
    } catch {
      return null;
    }
  }

  return null;
}

function base64SeedFromOtpUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol != "otpauth:") return null;

    const secret = u.searchParams.get("secret");
    if (secret == undefined) return null;

    return base32ToBase64(secret);
  } catch (_) {
    return null;
  }
}
