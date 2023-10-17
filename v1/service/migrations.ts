import { v4 as uuidv4 } from "uuid";

import { Vault } from "../uno_types";

function v0_v1(v: any): [any, boolean] {
  if (v.vaultSchemaMajor !== undefined && v.vaultSchemaMajor > 0) return [v, false];

  const newManual = v.manualItems.map(function (m: any) {
    if (m.id === undefined) {
      m.id = uuidv4().toUpperCase();
    }

    return m;
  });

  const newVault = v.vault.map(function (m: any) {
    if (m.id === undefined) {
      m.id = uuidv4().toUpperCase();
    }

    return m;
  });

  v.vaultSchemaMajor = 1;
  v.manualItems = newManual;
  v.vault = newVault;
  return [v, true];
}

const migrations = [v0_v1];

export function migrateVault(vault: Vault): [Vault, boolean] {
  let result = vault;
  let needsWrite = false;

  migrations.forEach(function (m) {
    [result, needsWrite] = m(result);
  });

  return [result, needsWrite];
}
