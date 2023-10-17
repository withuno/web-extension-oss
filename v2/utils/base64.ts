export namespace Base64 {
  export interface Options {
    utf8?: boolean;
  }

  /**
   * Encodes a Base64 string. Safe for UTF-8 characters if `options.utf8 === true`.
   */
  export function encode(input: string, options: Options = {}): string {
    const { utf8 = true } = options;
    if (utf8) {
      return btoa(encodeURIComponent(input).replace(/%[0-9A-F]{2}/g, percentToByte));
    }
    return btoa(input);
  }

  /**
   * Decodes a Base64 string. Safe for UTF-8 characters if `options.utf8 === true`.
   */
  export function decode(b64: string, options: Options = {}): string {
    const { utf8 = true } = options;
    if (utf8) {
      return decodeURIComponent(Array.from(atob(b64), byteToPercent).join(""));
    }
    return atob(b64);
  }

  /**
   * Encodes JSON as a Base64 string.
   */
  export function encodeJSON<T>(body: T, options: Options = {}): string {
    return encode(JSON.stringify(body), options);
  }

  /**
   * Decodes a Base64 string as JSON.
   */
  export function decodeJSON<T>(b64: string, options: Options = {}): T {
    return JSON.parse(decode(b64, options));
  }

  function percentToByte(p: string) {
    return String.fromCharCode(parseInt(p.slice(1), 16));
  }

  function byteToPercent(b: string) {
    return `%${`00${b.charCodeAt(0).toString(16)}`.slice(-2)}`;
  }
}

export namespace Base64URL {
  /**
   * From the given Base64 string (`b64`), return a new Base64URL-encoded
   * string with URI-unsafe characters replaced according to RFC 4648.
   *
   * NOTE: also removes Base64 padding characters ("=").
   */
  export function makeUriSafe(b64: string) {
    return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  /**
   * From the given Base64URL string (`b64URL`), return a new Base64-encoded
   * string with URI-unsafe characters restored according to RFC 4648.
   *
   * NOTE: also restores Base64 padding characters ("=").
   */
  export function unmakeUriSafe(b64URL: string) {
    return b64URL
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(b64URL.length + ((4 - (b64URL.length % 4)) % 4), "=");
  }

  /**
   * Encodes a Base64URL string. Safe for UTF-8 characters if `options.utf8 === true`.
   */
  export function encode(input: string, options: Base64.Options = {}): string {
    return makeUriSafe(encode(input, options));
  }

  /**
   * Decodes a Base64URL string. Safe for UTF-8 characters if `options.utf8 === true`.
   */
  export function decode(b64: string, options: Base64.Options = {}): string {
    return decode(unmakeUriSafe(b64), options);
  }

  /**
   * Encodes JSON as a Base64URL string.
   */
  export function encodeJSON<T>(body: T, options: Base64.Options = {}): string {
    return makeUriSafe(encode(JSON.stringify(body), options));
  }

  /**
   * Decodes a Base64URL string as JSON.
   */
  export function decodeJSON<T>(b64: string, options: Base64.Options = {}): T {
    return JSON.parse(decode(unmakeUriSafe(b64), options));
  }
}
