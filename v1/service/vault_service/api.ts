import init, { wasm_get_public_key, wasm_async_auth_header, wasm_sign_message } from "@/v2/wasm/wsm.js";

import { VaultServiceErrorKind, cacheKeyVclock, cacheKeyNextAuth } from "./service";
import { HttpMethod, Seed } from "../../uno_types";
import LocalStorageCache from "../local_storage_cache";

export class VaultApi {
  readonly hostname: string;
  readonly seed: Seed;
  readonly cache: LocalStorageCache<string>;

  constructor(hostname: string, seed: Seed, cache: LocalStorageCache<string>) {
    this.hostname = hostname;
    this.seed = seed;
    this.cache = cache;
  }

  private async asyncAuthHeader(
    nonce: string,
    method: string,
    endpoint_to_sign: string,
    body: Uint8Array,
    cost: number,
  ): Promise<string> {
    await init("./wsm_bg.wasm");

    const auth_header = wasm_async_auth_header(nonce, method, endpoint_to_sign, cost, body);

    if (auth_header == null) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    const signature = wasm_sign_message(this.seed, auth_header);
    if (signature == null) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    const identity = wasm_get_public_key(this.seed, false);
    if (identity == null) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    return `asym-tuned-digest-signature identity=${identity};nonce=${nonce};response=${auth_header};signature=${signature}`;
  }

  // endpoints that require auth.
  async fetchSignedEndpoint(
    endpoint_to_sign: string,
    endpoint: string,
    method: HttpMethod,
    headers: Headers,
    body: Uint8Array | null,
    fail_on_unauthorized: boolean,
    previous_auth: string | undefined,
  ): Promise<Response> {
    let response;
    let endpointURL;

    try {
      endpointURL = new URL(endpoint, this.hostname);
    } catch (e) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    if (previous_auth !== undefined) {
      const m = JSON.parse(previous_auth);

      const auth_header = await this.asyncAuthHeader(
        m[0],
        method,
        endpoint_to_sign,
        body === null ? new Uint8Array([]) : body,
        parseInt(m[1]),
      );

      headers.set("authorization", auth_header);
    }

    try {
      // TODO: (MANIFEST_V3) window does not exist in service workers
      response = await window.fetch(endpointURL.toString(), {
        method,
        headers,
        body,
      });
    } catch (e) {
      return Promise.reject({ kind: VaultServiceErrorKind.NetworkError });
    }

    if (!response.ok) {
      if (response.status !== 401) {
        if (response.status == 409) {
          // XXX: eventually this can be split to update and create,
          // in which case we can retry in the update method but for now
          // just return a NeedsSync error.
          // However, we can store the vclock for later...
          const v = response.headers.get("vclock");
          if (v !== null) {
            await this.cache.setValue(cacheKeyVclock(), v, -1);
          }

          return Promise.reject({ kind: VaultServiceErrorKind.NeedsSync });
        }

        if (response.status == 404) {
          return Promise.reject({ kind: VaultServiceErrorKind.NotFound });
        }

        return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
      }

      // else == 401
      if (fail_on_unauthorized) {
        return Promise.reject({ kind: VaultServiceErrorKind.Unauthorized });
      }

      const authenticate = response.headers.get("www-authenticate") ?? response.headers.get("uno-www-authn");

      if (authenticate == null) {
        console.log("failed to find auth info");
        return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
      }

      const authRE = /asym-tuned-digest-signature nonce=([A-Za-z0-9+/]+);algorithm=blake3\$([0-9]+);actions=([a-z,]+)/;

      const m = authenticate.match(authRE);
      if (m == null) {
        console.error("failed to find auth info");
        return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
      }

      // const nonce = m[1]
      // const cost  = m[2]
      const auth_header = await this.asyncAuthHeader(
        m[1],
        method,
        endpoint_to_sign,
        body === null ? new Uint8Array([]) : body,
        parseInt(m[2]),
      );

      headers.set("authorization", auth_header);

      return this.fetchSignedEndpoint(endpoint_to_sign, endpoint, method, headers, body, true, undefined);
    }

    const nextAuth = response.headers.get("authentication-info") ?? response.headers.get("uno-authn-info");

    if (nextAuth !== null) {
      const authRE = /nextnonce=([A-Za-z0-9+/]+);blake3=([0-9]+);scopes=[a-z,]+/;
      const m = nextAuth.match(authRE);

      if (m !== null) {
        await this.cache.setValue(cacheKeyNextAuth(endpoint_to_sign), JSON.stringify([m[1], m[2]]), 3600);
      }
    }

    const v = response.headers.get("vclock");
    if (v !== null) {
      await this.cache.setValue(cacheKeyVclock(), v, -1);
    }

    return response;
  }
}
