import { get, set } from "idb-keyval";

import { Seed, SessionId, SessionSeed } from "./uno_types";

/// Encrypted Seed

const VAULT_VCLOCK = "state/vaultVclock";
const STATE_REAL_SEED = "state/realSeed";
const STATE_REAL_SAFE_SEED = "state/realSafeSeed";
const SESSION_ID = "state/sessionId";
const CLIENT_ID = "state/clientId";
const SESSION_SEED = "state/sessionSeed";

function setValue<T>(key: string, value: T): Promise<null> {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.set({ [key]: value }, function () {
      if (chrome.runtime.lastError) {
        // XXX return an UnoError
        return reject(chrome.runtime.lastError);
      }

      resolve(null);
    });
  });
}

function getValue<T>(key: string): Promise<T> {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get([key], function (s: { [key: string]: T }) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }

      return resolve(s[key]);
    });
  });
}

function removeValue(key: string): Promise<null> {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.remove(key, function () {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }

      resolve(null);
    });
  });
}

export function clearSession() {
  chrome.storage.local.clear();
}

export function storeVclock(vclock: string): Promise<null> {
  return setValue<string>(VAULT_VCLOCK, vclock);
}

export function storeClientId(clientId: string): Promise<null> {
  return setValue<string>(CLIENT_ID, clientId);
}

export function storeSessionId(sessionId: SessionId): Promise<null> {
  return setValue<SessionId>(SESSION_ID, sessionId);
}

export function storeSessionSeed(sessionSeed: SessionSeed): Promise<null> {
  return setValue<SessionSeed>(SESSION_SEED, sessionSeed);
}

export async function storeRealSeed(seed: Seed): Promise<null> {
  await migrateIfNeeded();
  const container = await encryptRealSeed(seed);
  const containerStr = JSON.stringify(container);
  return await setValue<string>(STATE_REAL_SAFE_SEED, containerStr);
}

export async function realSeedFromStorage(): Promise<Seed | null> {
  try {
    await migrateIfNeeded();
    const containerStr = await getValue<string>(STATE_REAL_SAFE_SEED);
    if (containerStr === undefined) {
      return null;
    }

    const container = JSON.parse(containerStr);

    return await decryptCipherSeed(container);
  } catch (e) {
    return null;
  }
}

export function vclockFromStorage(): Promise<string> {
  return getValue<string>(VAULT_VCLOCK);
}

export function clientIdFromStorage(): Promise<string> {
  return getValue<string>(CLIENT_ID);
}

export function sessionIdFromStorage(): Promise<SessionId> {
  return getValue<SessionId>(SESSION_ID);
}

export function sessionSeedFromStorage(): Promise<SessionSeed> {
  return getValue<SessionSeed>(SESSION_SEED);
}

interface SeedContainer {
  encryptedSeed: Array<number>;
  iv: Array<number>;
}

const SEED_KEY = "key/seed";
const AD_SEED = "uno.seed";

async function encryptRealSeed(plaintext: Seed): Promise<SeedContainer> {
  const key = await get(SEED_KEY);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const utf8 = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8.encode(AD_SEED) },
    key,
    utf8.encode(plaintext),
  );
  return {
    encryptedSeed: Array.from(new Uint8Array(ciphertext)),
    iv: Array.from(iv),
  };
}

async function decryptCipherSeed(container: SeedContainer): Promise<Seed> {
  const key = await get(SEED_KEY);
  const seed = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(container.iv),
      additionalData: new TextEncoder().encode(AD_SEED),
    },
    key,
    new Uint8Array(container.encryptedSeed),
  );
  return new TextDecoder("utf-8").decode(seed);
}

async function migrateIfNeeded() {
  // 1. Create the key and save it in indexedDB.
  const existingKey = await get(SEED_KEY);
  if (existingKey === undefined) {
    console.log("Creating seed encryption key...");
    const newKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // `false` means non-extractable; this is important.
      ["encrypt", "decrypt"],
    );
    await set(SEED_KEY, newKey);
    console.log("Done.");
  }
  // 2. Encrypt the bare seed with the new key.
  const existingSeed = await getValue<any>(STATE_REAL_SEED);
  if (typeof existingSeed === "string") {
    console.log("Migrating plaintext seed...");
    const container = await encryptRealSeed(existingSeed);
    const containerStr = JSON.stringify(container);
    await setValue<string>(STATE_REAL_SAFE_SEED, containerStr);
    await removeValue(STATE_REAL_SEED);
    console.log("Done.");
  }
}
