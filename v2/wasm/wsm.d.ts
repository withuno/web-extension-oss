/* tslint:disable */
/* eslint-disable */
/**
* @param {string} seed
* @param {string} message
* @returns {string | undefined}
*/
export function wasm_sign_message(seed: string, message: string): string | undefined;
/**
* @param {string} nonce
* @param {string} method
* @param {string} resource
* @param {Uint8Array} salt
* @param {Uint8Array} body
* @param {number} argon_m
* @param {number} argon_t
* @param {number} argon_p
* @returns {string | undefined}
*/
export function wasm_auth_header(nonce: string, method: string, resource: string, salt: Uint8Array, body: Uint8Array, argon_m: number, argon_t: number, argon_p: number): string | undefined;
/**
* @param {string} nonce
* @param {string} method
* @param {string} resource
* @param {number} cost
* @param {Uint8Array} body
* @returns {string | undefined}
*/
export function wasm_async_auth_header(nonce: string, method: string, resource: string, cost: number, body: Uint8Array): string | undefined;
/**
* @param {string} seed_to_share
* @returns {string | undefined}
*/
export function wasm_share_seed(seed_to_share: string): string | undefined;
/**
* @param {string} share
* @param {string} seed
* @returns {string | undefined}
*/
export function wasm_decrypt_share(share: string, seed: string): string | undefined;
/**
* @param {string} share
* @returns {string | undefined}
*/
export function wasm_share_from_mnemonic(share: string): string | undefined;
/**
* @param {Uint8Array} share
* @param {string} seed
* @returns {string | undefined}
*/
export function wasm_decrypt_magic_share(share: Uint8Array, seed: string): string | undefined;
/**
* @param {string} vault
* @param {string} seed
* @returns {Uint8Array | undefined}
*/
export function wasm_encrypt_vault(vault: string, seed: string): Uint8Array | undefined;
/**
* @param {Uint8Array} vault
* @param {string} seed
* @returns {string | undefined}
*/
export function wasm_decrypt_vault(vault: Uint8Array, seed: string): string | undefined;
/**
* @param {string} mu
* @returns {string | undefined}
*/
export function wasm_generate_session_id(mu: string): string | undefined;
/**
* @param {string} seed
* @returns {string | undefined}
*/
export function wasm_get_public_key_url_encoded(seed: string): string | undefined;
/**
* @param {string} seed
* @param {boolean} url_encode
* @returns {string | undefined}
*/
export function wasm_get_public_key(seed: string, url_encode: boolean): string | undefined;
/**
* @param {string} query
* @returns {StringTuple | undefined}
*/
export function wasm_verify_params_from_query(query: string): StringTuple | undefined;
/**
*/
export class StringTuple {
  free(): void;
/**
*/
  0: string;
/**
*/
  1: string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly wasm_sign_message: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasm_auth_header: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => void;
  readonly wasm_async_auth_header: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
  readonly wasm_share_seed: (a: number, b: number, c: number) => void;
  readonly wasm_decrypt_share: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasm_share_from_mnemonic: (a: number, b: number, c: number) => void;
  readonly wasm_decrypt_magic_share: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasm_encrypt_vault: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasm_decrypt_vault: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasm_generate_session_id: (a: number, b: number, c: number) => void;
  readonly wasm_get_public_key_url_encoded: (a: number, b: number, c: number) => void;
  readonly wasm_get_public_key: (a: number, b: number, c: number, d: number) => void;
  readonly __wbg_stringtuple_free: (a: number) => void;
  readonly __wbg_get_stringtuple_0: (a: number, b: number) => void;
  readonly __wbg_set_stringtuple_0: (a: number, b: number, c: number) => void;
  readonly __wbg_get_stringtuple_1: (a: number, b: number) => void;
  readonly __wbg_set_stringtuple_1: (a: number, b: number, c: number) => void;
  readonly wasm_verify_params_from_query: (a: number, b: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
