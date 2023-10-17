import { Password, PasswordRequirement } from "./password-generator.types";
import { createRandomBytes } from "../random";

// Max size of passphrase in bytes
const MAX_PASSWORD_SIZE = 1024;

/**
 * Generates a cryptographically-random, high-entropy, pronounceable, and
 * memorable password.
 *
 * Based on the `niceware` NPM package.
 *
 * @see the LICENSE file at the root of this source tree:
 *   https://github.com/diracdeltas/niceware/tree/master
 *
 * Modifications from original source:
 *   - Removal of third-party dependencies.
 *   - Direct usage of `window.crypto.subtle` APIs.
 *   - Removed fallback to less-secure randomization.
 *   - Connect to custom password strength logic.
 */
export async function generateMemorablePassword(wordCount: number, delimiter = " ") {
  /** @see v2/templates/memorable-password-word-list.jsonc */
  const wordList: string[] = await fetch(chrome.runtime.getURL("memorable-password-word-list.json")).then((res) =>
    res.json(),
  );

  // Given our word list, each word equals 16-bits / 8-bytes of entropy
  // e.g.: 4-word password == 8 bytes in size.
  const size = wordCount * 2;
  const clampedSize = Math.min(Math.max(size, 0), MAX_PASSWORD_SIZE - 1);
  const bytes = createRandomBytes(clampedSize);

  return new Password(
    bytesToPassphrase(bytes, wordList).join(delimiter),
    [PasswordRequirement.Lower],
    1, // Add one for the `delimiter`
  );
}

/**
 * Converts a `Uint8Array` of bytes into a passphrase.
 */
function bytesToPassphrase(bytes: Uint8Array, wordList: string[]) {
  if (bytes.length % 2 === 1) {
    throw new Error("Only even-sized byte arrays are supported.");
  }
  const words = [];
  for (const entry of bytes.entries()) {
    const index = entry[0];
    const byte = entry[1];
    const next = bytes[index + 1];
    if (index % 2 === 0) {
      const wordIndex = byte * 256 + next;
      const word = wordList[wordIndex];
      if (!word) {
        throw new Error("Invalid byte encountered");
      } else {
        words.push(word);
      }
    }
  }
  return words;
}
