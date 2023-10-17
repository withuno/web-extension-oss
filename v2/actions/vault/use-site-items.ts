import type { Vault as VaultServiceVault } from "@/v1/service/vault_service/service";
import { Cache } from "@/v2/utils/cache";

/**
 * @returns A vault with only vault items relevant to the current URL hostname.
 */
export function useSiteItems() {
  return useSiteItems.cache.use(useSiteItems.cacheKey);
}

useSiteItems.cacheKey = "content-script-site-items";
useSiteItems.cache = new Cache.Memory<VaultServiceVault>(Infinity);
