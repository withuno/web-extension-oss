import init, {
  wasm_decrypt_share,
  wasm_generate_session_id,
  wasm_share_seed,
  wasm_share_from_mnemonic,
} from "@/v2/wasm/wsm.js";

import { HttpMethod, UnoError, Seed, SessionId, SessionSeed, EmailStatus } from "../uno_types";

export class SessionService {
  readonly hostname: string;

  constructor(hostname: string) {
    this.hostname = hostname;
  }

  private async fetchUnsignedEndpoint(
    endpoint: string,
    method: HttpMethod,
    headers: Headers,
    body: Uint8Array | null,
  ): Promise<Response> {
    let endpointURL;
    try {
      endpointURL = new URL(endpoint, this.hostname);
    } catch (e) {
      return Promise.reject(UnoError.Unknown);
    }

    let response;
    try {
      response = await window.fetch(endpointURL.toString(), {
        method,
        headers,
        body,
      });
    } catch (e) {
      return Promise.reject(UnoError.NetworkError);
    }

    if (!response.ok) {
      if (response.status == 404) {
        return Promise.reject(UnoError.NotFound);
      }

      return Promise.reject(UnoError.Unknown);
    }

    return response;
  }

  async getEmailStatus(email: string): Promise<EmailStatus> {
    await init("./wsm_bg.wasm");

    try {
      const encoder = new TextEncoder();

      const response = await this.fetchUnsignedEndpoint(
        `/v2/verify/lookup`,
        HttpMethod.Post,
        new Headers({
          "Content-Type": "application/json",
        }),
        encoder.encode(JSON.stringify({ email, include_pending: true })),
      );

      const j = await response.json();

      return j == true ? EmailStatus.Verified : EmailStatus.NotVerified;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async shareSeed(seed: Seed): Promise<SessionSeed> {
    await init("./wsm_bg.wasm");

    const seedShare = wasm_share_seed(seed);
    if (seedShare === undefined) {
      return Promise.reject(UnoError.Unknown);
    }

    return seedShare;
  }

  async seedFromPhrase(phrase: string): Promise<string> {
    await init("./wsm_bg.wasm");

    const seed = wasm_share_from_mnemonic(phrase);
    if (seed === undefined) {
      return Promise.reject(UnoError.NeedsOnboard);
    }

    return seed;
  }

  async createSession(crypto: any): Promise<[SessionId, SessionSeed]> {
    const array = new Uint8Array(10);
    crypto.getRandomValues(array);

    // https://developer.mozilla.org/en-US/docs/Web/API/btoa
    let result = "";
    for (let i = 0; i < 10; i++) {
      result += String.fromCharCode(array[i]);
    }

    const bseed = window.btoa(result);

    await init("./wsm_bg.wasm");
    const session_id = wasm_generate_session_id(bseed);
    if (session_id === undefined) {
      return Promise.reject(UnoError.SessionId);
    }

    const endpoint = new URL(`/v2/ssss/${session_id}`, this.hostname);
    // XXX: check response
    await window.fetch(endpoint.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: {} }),
    });

    return [session_id, bseed];
  }

  async recoverRealSeed(session_id: string, seed: string): Promise<Seed | undefined> {
    const endpoint = new URL(`/v2/ssss/${session_id}`, this.hostname);
    const response = await window.fetch(endpoint.toString());
    if (!response.ok) {
      console.log("response is not ok.");
      return Promise.reject(UnoError.BadResponse);
    }

    const j = await response.json();
    if (j.shares === undefined) {
      return Promise.resolve(undefined);
    }

    // figure out what to do in this situation
    if (j.shares.length !== 1) {
      console.log("shares.length != 1");
      return Promise.reject(UnoError.BadSessionShares);
    }

    await init("./wsm_bg.wasm");
    const share = wasm_decrypt_share(j.shares[0], seed);
    if (share == null) {
      console.log("share could not be decrypted.");
      return Promise.reject(UnoError.ShareDecryption);
    }

    return share;
  }
}
