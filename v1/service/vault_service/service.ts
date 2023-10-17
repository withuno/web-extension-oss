import vaultSchema7 from "@withuno/vault-schema/schemas/7/vault.json";
import Ajv from "ajv/dist/2019";
import ajv_formats from "ajv-formats";
import { v4 as uuidv4 } from "uuid";

import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";
import init, { wasm_encrypt_vault, wasm_get_public_key, wasm_decrypt_vault } from "@/v2/wasm/wsm.js";

import { VaultApi } from "./api";
import { maybeMigrateVault } from "./migrations";
import Logger from "../../logger";
import {
  Seed,
  LoginItem,
  VaultItemId,
  ServiceList,
  HttpMethod,
  VisibleVaultItem,
  CreditCardItem,
  AddressItem,
  VerifiedStatus,
  VaultItem,
  CreateQuery,
  UpdateQuery,
  SchemaType,
  PrivateKeyItem,
  RefreshToken,
  SecureNoteItem,
} from "../../uno_types";
import { createAnalyticsEvent } from "../../utils";
import LocalStorageCache from "../local_storage_cache";

export enum VaultServiceErrorKind {
  NotFound, // 0
  NeedsSync, // 1
  FatalError, // 2
  Unauthorized, // 3
  NetworkError, // 4
  ClientOutOfDate, // 5
  SchemaValidation, // 6
}

export type VaultServiceError = {
  kind: VaultServiceErrorKind;
  errors: Array<any>;
};

export type Vault = {
  schema_major: number;
  schema_minor: number;
  uuid: string | undefined;
  email: string | undefined;
  items: Array<LoginItem>;
  addresses: Array<AddressItem>;
  creditCards: Array<CreditCardItem>;
  privateKeys: Array<PrivateKeyItem>;
  refreshTokens: Array<RefreshToken>;
  notes: Array<SecureNoteItem>;
};

export function cacheKeyVclock(): string {
  return `v3::vault_service::vclock`;
}

export function cacheKeyNextAuth(endpoint: string): string {
  return `v3::vault_service::nextAuth::${endpoint}`;
}

function cacheKeyVault(): string {
  return `v3::vault_service::remoteVault`;
}

function cacheKeyServiceList(): string {
  return "v3::vault_service::serviceList";
}

// takes a formatted url and makes it look nice
// for the vault.
function prettyUrl(url: URL): string {
  let h = url.host;

  h = h.replace(/^www\./, "");
  h = h.replace(/^app\./, "");
  h = h.replace(/^mobile\./, "");
  h = h.replace(/^accounts?\./, "");

  return h;
}

// takes a user input "url" and makes it real or nothing.
function formatUrl(fragment?: string): URL | null {
  if (!fragment) return null;

  try {
    const u = new URL(fragment);
    return u;
  } catch {
    const u = new URL(`https://${fragment}`);
    return u;
  }
}

function visibleVaultItem(vv: LoginItem, item: ServiceList[0] | undefined): LoginItem {
  if (item === undefined) return visibleManualItem(vv);

  return {
    ...vv,
    name: item.display_name ? item.display_name : vv.name,
    matching_hosts: item.matching_hosts ? item.matching_hosts : [],
  };
}

function visibleManualItem(vv: LoginItem): LoginItem {
  const m = formatUrl(vv.url);

  let hostResult = Array<string>();
  if (m !== null) {
    hostResult = [m.host];
  }

  return {
    ...vv,
    name: vv.name ?? (m !== null ? prettyUrl(m) : vv.url),
    matching_hosts: hostResult,
  };
}

export function newDefaultVaultService(
  hostname: string,
  seed: Seed,
  client_id: string,
  schema_major: number,
  logger: Logger,
): VaultService {
  const cache = new LocalStorageCache<string>();
  const api = new VaultApi(hostname, seed, cache);

  return new VaultService(api, seed, client_id, cache, schema_major, logger);
}

export class VaultService {
  readonly api: VaultApi;
  readonly seed: Seed;
  readonly client_id: string;
  readonly cache: LocalStorageCache<string>;
  readonly max_schema_major: number;
  readonly logger: Logger;

  readonly schema_validator: any;

  constructor(
    api: VaultApi,
    seed: Seed,
    client_id: string,
    cache: LocalStorageCache<string>,
    max_schema_major: number,
    logger: Logger,
  ) {
    this.api = api;
    this.seed = seed;
    this.client_id = client_id;
    this.cache = cache;
    this.max_schema_major = max_schema_major;
    this.logger = logger;

    const ajv = new Ajv();
    ajv_formats(ajv);
    this.schema_validator = ajv.compile(vaultSchema7);
  }

  // public key of the seed
  public async vaultId(): Promise<string> {
    await init("./wsm_bg.wasm");

    const v = wasm_get_public_key(this.seed, true);
    if (v == null) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    return v;
  }

  private maybeValidate(vault: any): Array<any> {
    // we can't validate any schema less than major 7
    if (vault.vaultSchemaMajor === undefined || vault.vaultSchemaMajor < 7) {
      return [];
    }

    try {
      const valid = this.schema_validator(vault);
      if (valid) {
        this.logger.info("schema ok");
        return [];
      }
    } catch (e) {
      this.logger.error("could not run schema validation");
      this.logger.error(e);
    }

    createAnalyticsEvent(LegacyAnalyticsEvent.SchemaValidationFailure);

    if (this.logger.env != "production") {
      return [this.schema_validator.errors];
    }

    return [];
  }

  private async encryptVault(vault: Vault): Promise<Uint8Array> {
    await init("./wsm_bg.wasm");

    const vaultString = JSON.stringify(vault);
    const vaultEncrypted = wasm_encrypt_vault(vaultString, this.seed);
    if (vaultEncrypted === undefined) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    return vaultEncrypted;
  }

  private async remoteGetVault(): Promise<Response> {
    const url_id = await this.vaultId();
    const response = await this.api.fetchSignedEndpoint(
      `/${url_id}`,
      `/v2/vaults/${url_id}`,
      HttpMethod.Get,
      new Headers(),
      null,
      false,
      undefined,
    );

    return response;
  }

  private async decryptVault(encrypted_vault: Array<number>): Promise<any> {
    await init("./wsm_bg.wasm");
    const decrypted: any = wasm_decrypt_vault(Uint8Array.from(encrypted_vault), this.seed);

    if (decrypted === undefined) {
      return undefined;
    }

    return JSON.parse(decrypted);
  }

  // This specifically returns an any because we might have unknown
  // JSON fields in the vault, and we don't want to serialize something
  // that would overwrite them.
  // 6/27/2023 This should no longer be the case once we have schema type
  // definitions incorporated. -Chris
  async getRawVault(force_sync = false): Promise<any> {
    let encrypted_vault;

    let cameFromCache = false;
    const c = await this.cache.getValue(cacheKeyVault());
    try {
      if (!force_sync && c !== undefined) {
        cameFromCache = true;
        encrypted_vault = JSON.parse(c);
      } else {
        const remote_vault = await this.remoteGetVault();
        const body = await remote_vault.arrayBuffer();
        encrypted_vault = Array.from(new Uint8Array(body));
      }
    } catch (err) {
      await this.cache.deleteValue(cacheKeyVault());
      throw err;
    }

    let vault = await this.decryptVault(encrypted_vault);
    if (vault === undefined) {
      await this.cache.deleteValue(cacheKeyVault());
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    // if the vault was not cached, validate it, then cache..
    if (!cameFromCache) {
      let needsWrite = false;
      [vault, needsWrite] = maybeMigrateVault(vault);

      const valid = this.maybeValidate(vault);
      if (valid.length > 0) {
        await this.cache.deleteValue(cacheKeyVault());
        return Promise.reject({
          kind: VaultServiceErrorKind.SchemaValidation,
          errors: valid,
        });
      }

      try {
        if (needsWrite === true) {
          this.logger.info("uno: migrating vault...");
          await this.putRawVault(vault);

          // reload the server copy of the vault
          const remote_vault = await this.remoteGetVault();
          const body = await remote_vault.arrayBuffer();
          encrypted_vault = Array.from(new Uint8Array(body));
        }

        await this.cache.setValue(
          cacheKeyVault(),
          JSON.stringify(encrypted_vault),
          -1, // never expire vault cache until the next time `force_sync === true`
        );
      } catch (err) {
        await this.cache.deleteValue(cacheKeyVault());
        throw err;
      }
    }

    return vault;
  }

  async getServiceList(): Promise<ServiceList> {
    const c = await this.cache.getValue(cacheKeyServiceList());
    if (c !== undefined) return JSON.parse(c);

    const service_response = await this.api.fetchSignedEndpoint(
      `/services.json`,
      `/v2/services/services.json`,
      HttpMethod.Get,
      new Headers(),
      null,
      false,
      undefined,
    );

    const service_list = await service_response.json();

    await this.cache.setValue(cacheKeyServiceList(), JSON.stringify(service_list), 86400); // 1 day

    return service_list;
  }

  async clearLocalVault(): Promise<void> {
    await this.cache.deleteValue(cacheKeyVault());
    await this.cache.deleteValue(cacheKeyServiceList());
  }

  async updateVaultEmail(email: string): Promise<void> {
    const vault = await this.getRawVault(true);
    vault.email = email;

    await this.putRawVault(vault);
  }

  async startVerifyEmail(): Promise<void> {
    const encoder = new TextEncoder();

    const vault = await this.getRawVault();

    await this.api.fetchSignedEndpoint(
      `/entries`,
      `/v2/verify/entries`,
      HttpMethod.Post,
      new Headers({
        "Content-Type": "application/json",
      }),
      encoder.encode(JSON.stringify({ analytics_id: vault.uuid, email: vault.email })),
      false,
      undefined,
    );
  }

  async getVerifiedStatus(): Promise<VerifiedStatus> {
    try {
      const url_id = await this.vaultId();
      const response = await this.api.fetchSignedEndpoint(
        `/entries/${url_id}`,
        `/v2/verify/entries/${url_id}`,
        HttpMethod.Get,
        new Headers(),
        null,
        false,
        undefined,
      );

      const j = await response.json();

      if (j.status === undefined || j.email === undefined) {
        this.logger.error("bad verify entry");
        return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
      }

      const vaultEmail = await this.getVaultEmail();
      if (vaultEmail === "" || j.email !== vaultEmail) {
        return VerifiedStatus.NotEmailed;
      }

      if (j.status === "pending") {
        return VerifiedStatus.EmailedNotVerified;
      }

      return VerifiedStatus.Verified;
    } catch (e) {
      if ((e as VaultServiceError).kind === VaultServiceErrorKind.NotFound) {
        return VerifiedStatus.NotEmailed;
      }

      return Promise.reject(e);
    }
  }

  async getVaultItem(id: VaultItemId): Promise<VisibleVaultItem> {
    const vault = await this.getVault();

    const foundLoginItem = vault.items.find(function (m: any) {
      return m.id === id;
    });
    if (foundLoginItem !== undefined) {
      return { ...foundLoginItem, schema_type: "login" };
    }

    const foundCreditCardItem = vault.creditCards.find(function (m: any) {
      return m.id === id;
    });
    if (foundCreditCardItem !== undefined) {
      return { ...foundCreditCardItem, schema_type: "credit_card" };
    }

    const foundAddressItem = vault.addresses.find(function (m: any) {
      return m.id === id;
    });
    if (foundAddressItem !== undefined) {
      return { ...foundAddressItem, schema_type: "address" };
    }

    const foundPrivateKeyItem = vault.privateKeys.find(function (m: any) {
      return m.id === id;
    });
    if (foundPrivateKeyItem !== undefined) {
      return { ...foundPrivateKeyItem, schema_type: "private_key" };
    }

    const foundSecureNotesItem = vault.notes.find(function (m: any) {
      return m.id === id;
    });
    if (foundSecureNotesItem !== undefined) {
      return { ...foundSecureNotesItem, schema_type: "secure_note" };
    }

    return Promise.reject({ kind: VaultServiceErrorKind.NotFound });
  }

  // This routes to the correct CRUD method based on the given `type`... it's
  // too brittle though. We should have type guards that are smart enough to
  // determine the item type based on the `item` data alone.
  //
  // e.g.: because we lack proper type guards here, we have to use "any" and
  // cast `item` to the expected type for each case (which is ick).
  async createVaultItem<T extends SchemaType, Item extends VaultItem>(type: T, item: CreateQuery<Item>): Promise<Item> {
    let newItem: any;

    delete (item as any).schema_type;

    switch (type) {
      case "login":
        createAnalyticsEvent(LegacyAnalyticsEvent.CreateLoginItem);
        newItem = await this.createLoginItem(item as unknown as CreateQuery<LoginItem>);
        break;

      case "credit_card":
        createAnalyticsEvent(LegacyAnalyticsEvent.CreateCreditCardItem);
        newItem = await this.createCreditCardItem(item as unknown as CreateQuery<CreditCardItem>);
        break;

      case "address":
        createAnalyticsEvent(LegacyAnalyticsEvent.CreateAddressItem);
        newItem = await this.createAddressItem(item as unknown as CreateQuery<AddressItem>);
        break;

      case "private_key":
        createAnalyticsEvent(LegacyAnalyticsEvent.CreatePrivateKeyItem);
        newItem = await this.createPrivateKeyItem(item as unknown as CreateQuery<PrivateKeyItem>);
        break;

      case "secure_note":
        createAnalyticsEvent(LegacyAnalyticsEvent.CreateSecureNoteItem);
        newItem = await this.createSecureNoteItem(item as unknown as CreateQuery<SecureNoteItem>);
        break;

      default:
        throw { kind: VaultServiceErrorKind.FatalError };
    }

    return newItem;
  }

  // This routes to the correct CRUD method based on the given `type`... it's
  // too brittle though. We should have type guards that are smart enough to
  // determine the item type based on the `item` data alone.
  //
  // e.g.: because we lack proper type guards here, we have to use "any" and
  // cast `item` to the expected type for each case (which is ick).
  async updateVaultItem<T extends SchemaType, Item extends VaultItem>(type: T, item: UpdateQuery<Item>): Promise<Item> {
    let newItem: any;

    (item as any).schema_type = null;

    switch (type) {
      case "login":
        createAnalyticsEvent(LegacyAnalyticsEvent.UpdateLoginItem);
        newItem = await this.updateLoginItem(item as unknown as UpdateQuery<LoginItem>);
        break;

      case "credit_card":
        createAnalyticsEvent(LegacyAnalyticsEvent.UpdateCreditCardItem);
        newItem = await this.updateCreditCardItem(item as unknown as UpdateQuery<CreditCardItem>);
        break;

      case "address":
        createAnalyticsEvent(LegacyAnalyticsEvent.UpdateAddressItem);
        newItem = await this.updateAddressItem(item as unknown as UpdateQuery<AddressItem>);
        break;

      case "private_key":
        createAnalyticsEvent(LegacyAnalyticsEvent.UpdatePrivateKeyItem);
        newItem = await this.updatePrivateKeyItem(item as unknown as UpdateQuery<PrivateKeyItem>);
        break;

      case "secure_note":
        createAnalyticsEvent(LegacyAnalyticsEvent.UpdateSecureNoteItem);
        newItem = await this.updateSecureNoteItem(item as unknown as UpdateQuery<SecureNoteItem>);

        break;

      default:
        throw { kind: VaultServiceErrorKind.FatalError };
    }

    return newItem;
  }

  async deleteVaultItem(id: VaultItemId) {
    const vault = await this.getRawVault(true);

    let foundLoginItem = vault.manualItems?.findIndex((m: any) => m.id === id);
    if (foundLoginItem > -1) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DeleteLoginItem);
      vault.manualItems.splice(foundLoginItem, 1);
      await this.putRawVault(vault);
      return vault.manualItems[foundLoginItem];
    }

    foundLoginItem = vault.vault?.findIndex((m: any) => m.id === id);
    if (foundLoginItem > -1) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DeleteLoginItem);
      vault.vault.splice(foundLoginItem, 1);
      await this.putRawVault(vault);
      return vault.vault[foundLoginItem];
    }

    const foundCreditCardItem = vault.creditCards?.findIndex((m: any) => m.id === id);
    if (foundCreditCardItem > -1) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DeleteCreditCardItem);
      vault.creditCards.splice(foundCreditCardItem, 1);
      await this.putRawVault(vault);
      return vault.creditCards[foundCreditCardItem];
    }

    const foundAddressItem = vault.addresses?.findIndex((m: any) => m.id === id);
    if (foundAddressItem > -1) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DeleteAddressItem);
      vault.addresses.splice(foundAddressItem, 1);
      await this.putRawVault(vault);
      return vault.addresses[foundAddressItem];
    }

    const foundPrivateKeyItem = vault.privateKeys?.findIndex((m: any) => m.id === id);
    if (foundPrivateKeyItem > -1) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DeletePrivateKeyItem);
      vault.privateKeys.splice(foundPrivateKeyItem, 1);
      await this.putRawVault(vault);
      return vault.privateKeys[foundPrivateKeyItem];
    }

    const foundSecureNoteItem = vault.notes?.findIndex((m: any) => m.id === id);
    if (foundSecureNoteItem > -1) {
      createAnalyticsEvent(LegacyAnalyticsEvent.DeleteSecureNoteItem);
      vault.notes.splice(foundSecureNoteItem, 1);
      await this.putRawVault(vault);
      return vault.notes[foundSecureNoteItem];
    }

    throw { kind: VaultServiceErrorKind.NotFound };
  }

  async getVaultEmail(): Promise<string | undefined> {
    const vault = await this.getRawVault();
    return vault.email;
  }

  // NOTE: 6/27/23 I recommend moving this logic in the background script.
  // Once we have schema type files in place, we should not need to
  // materialize the vault like we do in the return statement here -Chris
  async getVault(force_sync = false): Promise<Vault> {
    // const service_list = await this.getServiceList();
    const vault = await this.getRawVault(force_sync);

    const vault_items = vault.vault.map(function (vv: LoginItem) {
      return visibleVaultItem(vv, undefined);
    });

    const manual_items = vault.manualItems.map(visibleManualItem);

    return {
      email: vault.email,
      uuid: vault.uuid,
      schema_major: vault.vaultSchemaMajor,
      schema_minor: vault.vaultSchemaMinor,
      items: vault_items.concat(manual_items),
      creditCards: vault.creditCards || [],
      addresses: vault.addresses || [],
      privateKeys: vault.privateKeys || [],
      refreshTokens: vault.refreshTokens || [],
      notes: vault.notes || [],
    };
  }

  private nextVclock(vclock: string | undefined): string {
    if (vclock === undefined) vclock = "";

    const clocks = vclock.split(",").map(function (c) {
      const kv = c.split("=");
      if (kv.length != 2) return undefined;
      return { client: kv[0], count: parseInt(kv[1]) };
    });

    const selfClientId = this.client_id;
    const existing = clocks.findIndex(function (c) {
      if (c === undefined) return false;

      return c.client == selfClientId.toUpperCase();
    });

    if (existing == -1) {
      clocks.push({ client: this.client_id.toUpperCase(), count: 1 });
    } else {
      // XXX i don't get why typescript won't accept this without casting?
      if (clocks[existing] !== undefined) {
        (clocks[existing] as any).count = (clocks[existing] as any).count + 1;
      }
    }

    return clocks
      .map(function (c) {
        if (c !== undefined) {
          return `${c.client}=${c.count}`;
        }
      })
      .filter(function (c) {
        return c !== undefined;
      })
      .join(",");
  }

  public async putRawVault(vault: any): Promise<void> {
    try {
      // XXX: this is pretty specific to the "vault 0" to "vault 1" transition...
      if (vault.vaultSchemaMajor !== undefined) {
        if (vault.vaultSchemaMajor > this.max_schema_major) {
          return Promise.reject({
            kind: VaultServiceErrorKind.ClientOutOfDate,
          });
        }
      }

      const valid = this.maybeValidate(vault);
      if (valid.length > 0) {
        return Promise.reject({
          kind: VaultServiceErrorKind.SchemaValidation,
          errors: valid,
        });
      }

      const url_id = await this.vaultId();
      const vaultEncrypted = await this.encryptVault(vault);

      const currentVclock = await this.cache.getValue(cacheKeyVclock());
      const vclock = this.nextVclock(currentVclock);

      await this.api.fetchSignedEndpoint(
        `/${url_id}`,
        `/v2/vaults/${url_id}`,
        HttpMethod.Put,
        new Headers({
          "Content-Type": "application/octet-stream",
          vclock,
        }),
        vaultEncrypted,
        false,
        undefined,
      );

      // TODO: once the write succeeds, we can expire the vault cache.
      // But if the next call to synchronize with the server fails,
      // the user will see no local vault, only an error.
      // Is this better or worse than showing them a vault with an
      // item that looks different than what they just edited? -Chris
      await this.cache.deleteValue(cacheKeyVault());
      await this.getRawVault();
    } catch (err) {
      createAnalyticsEvent(LegacyAnalyticsEvent.WriteVaultFailure);
      throw err;
    }
  }

  async createVault(email: string | undefined): Promise<boolean> {
    await init("./wsm_bg.wasm");

    const public_key = wasm_get_public_key(this.seed, false);
    if (public_key == null) {
      return Promise.reject({ kind: VaultServiceErrorKind.FatalError });
    }

    const vault_id = uuidv4();

    const emptyVault = {
      idCardValue: public_key,
      vaultSchemaMinor: 0,
      vaultSchemaMajor: this.max_schema_major,
      uuid: vault_id,
      email,
      vault: [],
      manualItems: [],
      contacts: [],
      confidants: [],
      oldPasswords: [],
      privateKeys: [],
    };

    await this.putRawVault(emptyVault);

    return true;
  }

  async createLoginItem(item: CreateQuery<LoginItem>): Promise<LoginItem> {
    const formattedItemURL = formatUrl(item.url);

    // XXX: should we remove 'matching_hosts' here?
    const newLoginItem: LoginItem = {
      ...item,
      id: uuidv4(),
      relatedItems: item.relatedItems ?? [],
      ssoProvider: item.ssoProvider ?? [],
      name: item.name ?? (formattedItemURL != null ? prettyUrl(formattedItemURL) : item.url),
      matching_hosts: formattedItemURL != null ? [formattedItemURL.host] : [],
    };

    const vault = await this.getRawVault(true);
    vault.manualItems.push(newLoginItem);
    await this.putRawVault(vault);

    return newLoginItem;
  }

  // XXX: This is brittle, but i don't have any better ideas right now...
  // A field with value 'undefined' will be ignored.
  // A field with value 'null' will be deleted.
  async updateLoginItem(updated: UpdateQuery<LoginItem>): Promise<LoginItem> {
    const vault = await this.getRawVault(true);

    // remove undefined fields
    for (const v in updated) {
      if ((updated as any)[v] === undefined) {
        delete (updated as any)[v];
      }
    }

    if (updated.relatedItems === null) {
      updated.relatedItems = [];
    }

    let found = vault.manualItems.findIndex(function (m: any) {
      return m.id === updated.id;
    });

    if (found > -1) {
      const toUpdate = { ...vault.manualItems[found], ...updated };
      for (const v in toUpdate) {
        if (toUpdate[v] === null) {
          delete toUpdate[v];
        }
      }

      vault.manualItems[found] = toUpdate;
      await this.putRawVault(vault);
      return toUpdate;
    }

    found = vault.vault.findIndex(function (m: any) {
      return m.id === updated.id;
    });

    if (found > -1) {
      const toUpdate = { ...vault.vault[found], ...updated };
      for (const v in toUpdate) {
        if (toUpdate[v] === null) {
          delete toUpdate[v];
        }
      }

      vault.vault[found] = toUpdate;
      await this.putRawVault(vault);
      return toUpdate;
    }

    throw { kind: VaultServiceErrorKind.NotFound };
  }

  async createCreditCardItem(item: CreateQuery<CreditCardItem>): Promise<CreditCardItem> {
    const newCreditCardItem: CreditCardItem = {
      ...item,
      id: uuidv4(),
    };

    const vault = await this.getRawVault(true);
    if (!vault.creditCards) {
      vault.creditCards = [];
    }
    vault.creditCards.push(newCreditCardItem);
    await this.putRawVault(vault);

    return newCreditCardItem;
  }

  // XXX: This is brittle, but i don't have any better ideas right now...
  // A field with value 'undefined' will be ignored.
  // A field with value 'null' will be deleted.
  async updateCreditCardItem(updated: UpdateQuery<CreditCardItem>): Promise<CreditCardItem> {
    const vault = await this.getRawVault(true);

    // remove undefined fields
    for (const v in updated) {
      if ((updated as any)[v] === undefined) {
        delete (updated as any)[v];
      }
    }

    const found = vault.creditCards.findIndex(function (m: any) {
      return m.id === updated.id;
    });

    if (found > -1) {
      const toUpdate = { ...vault.creditCards[found], ...updated };
      for (const v in toUpdate) {
        if (toUpdate[v] === null) {
          delete toUpdate[v];
        }
      }

      vault.creditCards[found] = toUpdate;
      await this.putRawVault(vault);
      return toUpdate;
    }

    throw { kind: VaultServiceErrorKind.NotFound };
  }

  async createAddressItem(item: CreateQuery<AddressItem>): Promise<AddressItem> {
    const newAddressItem: AddressItem = {
      ...item,
      id: uuidv4(),
    };

    const vault = await this.getRawVault(true);
    if (!vault.addresses) {
      vault.addresses = [];
    }
    vault.addresses.push(newAddressItem);
    await this.putRawVault(vault);

    return newAddressItem;
  }

  // XXX: This is brittle, but i don't have any better ideas right now...
  // A field with value 'undefined' will be ignored.
  // A field with value 'null' will be deleted.
  async updateAddressItem(updated: UpdateQuery<AddressItem>): Promise<AddressItem> {
    const vault = await this.getRawVault(true);

    // remove undefined fields
    for (const v in updated) {
      if ((updated as any)[v] === undefined) {
        delete (updated as any)[v];
      }
    }

    const found = vault.addresses.findIndex(function (m: any) {
      return m.id === updated.id;
    });

    if (found > -1) {
      const toUpdate = { ...vault.addresses[found], ...updated };
      for (const v in toUpdate) {
        if (toUpdate[v] === null) {
          delete toUpdate[v];
        }
      }

      vault.addresses[found] = toUpdate;
      await this.putRawVault(vault);
      return toUpdate;
    }

    throw { kind: VaultServiceErrorKind.NotFound };
  }

  async createPrivateKeyItem(item: CreateQuery<PrivateKeyItem>): Promise<PrivateKeyItem> {
    const newPrivateKeyItem: PrivateKeyItem = {
      ...item,
      id: uuidv4(),
    };

    const vault = await this.getRawVault(true);
    if (!vault.privateKeys) {
      vault.privateKeys = [];
    }
    vault.privateKeys.push(newPrivateKeyItem);
    await this.putRawVault(vault);

    return newPrivateKeyItem;
  }

  // XXX: This is brittle, but i don't have any better ideas right now...
  // A field with value 'undefined' will be ignored.
  // A field with value 'null' will be deleted.
  async updatePrivateKeyItem(updated: UpdateQuery<PrivateKeyItem>): Promise<PrivateKeyItem> {
    const vault = await this.getRawVault(true);

    // remove undefined fields
    for (const v in updated) {
      if ((updated as any)[v] === undefined) {
        delete (updated as any)[v];
      }
    }

    const found = vault.privateKeys.findIndex(function (m: any) {
      return m.id === updated.id;
    });

    if (found > -1) {
      const toUpdate = { ...vault.privateKeys[found], ...updated };
      for (const v in toUpdate) {
        if (toUpdate[v] === null) {
          delete toUpdate[v];
        }
      }

      vault.privateKeys[found] = toUpdate;
      await this.putRawVault(vault);
      return toUpdate;
    }

    throw { kind: VaultServiceErrorKind.NotFound };
  }

  async createSecureNoteItem(item: CreateQuery<SecureNoteItem>): Promise<SecureNoteItem> {
    const newSecureNoteItem: SecureNoteItem = {
      ...item,
      id: uuidv4(),
    };

    const vault = await this.getRawVault(true);
    if (!vault.notes) {
      vault.notes = [];
    }
    vault.notes.push(newSecureNoteItem);
    await this.putRawVault(vault);

    return newSecureNoteItem;
  }

  // XXX: This is brittle, but i don't have any better ideas right now...
  // A field with value 'undefined' will be ignored.
  // A field with value 'null' will be deleted.
  async updateSecureNoteItem(updated: UpdateQuery<SecureNoteItem>): Promise<SecureNoteItem> {
    const vault = await this.getRawVault(true);

    // remove undefined fields
    for (const v in updated) {
      if ((updated as any)[v] === undefined) {
        delete (updated as any)[v];
      }
    }

    const found = vault.notes.findIndex(function (m: any) {
      return m.id === updated.id;
    });

    if (found > -1) {
      const toUpdate = { ...vault.notes[found], ...updated };
      for (const v in toUpdate) {
        if (toUpdate[v] === null) {
          delete toUpdate[v];
        }
      }

      vault.notes[found] = toUpdate;
      await this.putRawVault(vault);
      return toUpdate;
    }

    throw { kind: VaultServiceErrorKind.NotFound };
  }

  // TODO: Deprecate this in favor of `createCreditCardItem`. This is kept
  //       in-place until we refactor much of the `VaultService` to include
  //       hardened schema + validation.
  async addCreditCardToVault(cc: CreditCardItem): Promise<CreditCardItem> {
    const vault = await this.getRawVault();

    if (vault.creditCards && vault.creditCards instanceof Array) {
      vault.creditCards.push(cc);
    } else if (vault.creditCards === undefined) {
      vault.creditCards = [cc];
    }

    // DANGER: To reset credit cards in your vault, uncomment this and save a credit card
    // vault.creditCards = [];

    await this.putRawVault(vault);

    return cc;
  }

  // TODO: Deprecate this in favor of `createAddressItem`. This is kept in-place
  //       until we refactor much of the `VaultService` to include hardened
  //       schema + validation.
  async addAddressToVault(address: AddressItem): Promise<AddressItem> {
    const vault = await this.getRawVault(true);

    if (vault.addresses && vault.addresses instanceof Array) {
      vault.addresses.push(address);
    } else if (vault.addresses === undefined) {
      vault.addresses = [address];
    }

    // DANGER: To reset credit cards in your vault, uncomment this and save a credit card
    // vault.address = [];

    await this.putRawVault(vault);

    return address;
  }

  async addOrUpdateRefreshToken(item: CreateQuery<RefreshToken>): Promise<RefreshToken> {
    const newRefreshToken: RefreshToken = {
      ...item,
      id: uuidv4(),
    };

    const vault = await this.getRawVault(true);
    if (!vault.refreshTokens) {
      vault.refreshTokens = [];
    } else if (vault.refreshTokens.length) {
      // if the client id already exists in the array, remove it
      for (let i = vault.refreshTokens.length - 1; i >= 0; i--) {
        if (vault.refreshTokens[i].clientId === item.clientId) {
          vault.refreshTokens.splice(i, 1);
        }
      }
    }

    vault.refreshTokens.push(newRefreshToken);
    await this.putRawVault(vault);

    return newRefreshToken;
  }

  getAiAssistHelpText(topic: string, domain: string): Promise<{ steps?: string[]; action_url?: string }> {
    const encoder = new TextEncoder();
    return this.api
      .fetchSignedEndpoint(
        `/topics`,
        `/v2/assist/topics`,
        HttpMethod.Post,
        new Headers({
          "Content-Type": "application/json",
        }),
        encoder.encode(JSON.stringify({ topic, domain })),
        false,
        undefined,
      )
      .then((res) => res.json())
      .then((data) => {
        return JSON.parse(data?.choices?.[0]?.message?.content ?? `{}`);
      });
  }
}
