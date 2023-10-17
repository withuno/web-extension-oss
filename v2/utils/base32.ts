/* eslint-disable no-fallthrough */

/**
 * @see https://golang.org/src/encoding/base32/base32.go
 */

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

interface Base32Encoding {
  encode: string;
  decodeMap: number[];
  paddingChar: number;
}

function createBase32Encoding(): Base32Encoding {
  const e: Base32Encoding = {
    encode: alphabet,
    decodeMap: [],
    paddingChar: 61, // ASCII "="
  };

  for (let i = 0; i < 256; i++) {
    e.decodeMap[i] = 0xff;
  }

  for (let i = 0; i < alphabet.length; i++) {
    e.decodeMap[alphabet.charCodeAt(i)] = i;
  }

  return e;
}

/**
 * Decodes a Base32 string as bytes.
 */
export function decodeBase32(base32: string, options: { withPadding?: boolean } = {}): Uint8Array {
  const { withPadding = false } = options;

  const buf: number[] = [];

  for (const v of base32) {
    const c = v.charCodeAt(0);
    if (c > 127) {
      // only support ascii values
      throw new Error(`Corrupt input ${JSON.stringify(base32)}`);
    }

    buf.push(c);
  }

  const e = createBase32Encoding();

  // this could be a uint8array
  const dst: number[] = [];

  let dsti = 0;
  let end = false;

  while (buf.length > 0 && !end) {
    const dbuf: number[] = [];
    let dlen = 8;

    for (let j = 0; j < 8; ) {
      if (buf.length === 0) {
        if (withPadding) {
          throw new Error(`Corrupt input ${JSON.stringify(base32)}`);
        }

        dlen = j;
        end = true;
        break;
      }

      const input: number = buf.shift() as number;

      if (input == e.paddingChar && j >= 2 && buf.length < 8) {
        if (buf.length + j < 8 - 1) {
          // not enough padding
          throw new Error(`Corrupt input ${JSON.stringify(base32)}`);
        }

        for (let k = 0; k < 8 - 1 - j; k++) {
          if (buf.length > k && buf[k] != e.paddingChar) {
            // incorrect padding
            throw new Error(`Corrupt input ${JSON.stringify(base32)}`);
          }
        }

        dlen = j;
        end = true;

        if (dlen == 1 || dlen == 3 || dlen == 6) {
          // see comment https://golang.org/src/encoding/base32/base32.go
          throw new Error(`Corrupt input ${JSON.stringify(base32)}`);
        }

        break;
      }

      dbuf[j] = e.decodeMap[input];
      if (dbuf[j] === 0xff) {
        throw new Error(`Corrupt input ${JSON.stringify(base32)}`);
      }

      j++;
    }

    switch (dlen) {
      // @ts-expect-error — expect fallthrough
      case 8:
        dst[dsti + 4] = ((dbuf[6] << 5) | dbuf[7]) & 0xff;
      // @ts-expect-error — expect fallthrough
      case 7:
        dst[dsti + 3] = ((dbuf[4] << 7) | (dbuf[5] << 2) | (dbuf[6] >> 3)) & 0xff;
      // @ts-expect-error — expect fallthrough
      case 5:
        dst[dsti + 2] = ((dbuf[3] << 4) | (dbuf[4] >> 1)) & 0xff;
      // @ts-expect-error — expect fallthrough
      case 4:
        dst[dsti + 1] = ((dbuf[1] << 6) | (dbuf[2] << 1) | (dbuf[3] >> 4)) & 0xff;
      case 2:
        dst[dsti + 0] = ((dbuf[0] << 3) | (dbuf[1] >> 2)) & 0xff;
        break;
    }

    dsti += 5;
  }

  // This can be converted earlier or we can use typed arrays the whole time.
  const result = new ArrayBuffer(dst.length);
  const view = new Uint8Array(result);
  for (let i = 0; i < dst.length; i++) {
    view[i] = dst[i];
  }

  return view;
}

/**
 * Decodes a Base32 string and re-encodes the bytes as Base64.
 */
export function base32ToBase64(base32: string): string {
  const b32bytes = decodeBase32(base32);
  return btoa(String.fromCharCode.apply(null, Array.from(b32bytes)));
}
