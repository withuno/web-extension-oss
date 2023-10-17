import { v4 as uuidv4 } from "uuid";

/* All of these migrations assume that the schema has been validated already. */

function v0_v1(v: any): any {
  let newManual = [];
  let newVault = [];

  if (v.manualItems !== undefined) {
    newManual = v.manualItems.map(function (m: any) {
      if (m.id === undefined) {
        m.id = uuidv4().toUpperCase();
      }

      return m;
    });
  }

  if (v.vault !== undefined) {
    newVault = v.vault.map(function (m: any) {
      if (m.id === undefined) {
        m.id = uuidv4().toUpperCase();
      }

      return m;
    });
  }

  v.vaultSchemaMajor = 1;
  v.manualItems = newManual;
  v.vault = newVault;
  return v;
}

function v1_v2(v: any): any {
  v.vaultSchemaMajor = 2;
  v.vaultSchemaMinor = 0;

  return v;
}

function v2_v3(v: any): any {
  v.vaultSchemaMajor = 3;
  v.vaultSchemaMinor = 0;

  return v;
}

function v3_v4(v: any): any {
  v.vaultSchemaMajor = 4;
  v.vaultSchemaMinor = 0;

  return v;
}

function v4_v5(v: any): any {
  v.vaultSchemaMajor = 5;
  v.vaultSchemaMinor = 0;

  return v;
}

function v5_v6(v: any): any {
  v.vaultSchemaMajor = 6;
  v.vaultSchemaMinor = 0;

  return v;
}

function v6_v7(v: any): any {
  v.vaultSchemaMajor = 7;
  v.vaultSchemaMinor = 0;

  return v;
}

function hotfix_62723(vault: any): [any, boolean] {
  let needsWrite = false;

  if (vault.vault !== undefined) {
    for (let i = 0; i < vault.vault.length; i++) {
      if (vault.vault[i].ssoProvider !== undefined) {
        for (let j = 0; j < vault.vault[i].ssoProvider.length; j++) {
          if (vault.vault[i].ssoProvider[j].base !== undefined) {
            needsWrite = true;
            vault.vault[i].ssoProvider.splice(j, 1);
            continue;
          }

          if (Object.keys(vault.vault[i].ssoProvider[j]).length !== 3) {
            needsWrite = true;
            const newProvider = {
              default: vault.vault[i].ssoProvider[j].default,
              provider: vault.vault[i].ssoProvider[j].provider,
              username: vault.vault[i].ssoProvider[j].username,
            };

            vault.vault[i].ssoProvider[j] = newProvider;
          }

          if (vault.vault[i].ssoProvider[j].default === null || vault.vault[i].ssoProvider[j].default === undefined) {
            needsWrite = true;
            vault.vault[i].ssoProvider[j].default = false;
          }

          if (vault.vault[i].ssoProvider[j].provider === null || vault.vault[i].ssoProvider[j].provider === undefined) {
            needsWrite = true;
            vault.vault[i].ssoProvider[j].provider = "";
          }

          if (vault.vault[i].ssoProvider[j].username === null || vault.vault[i].ssoProvider[j].username === undefined) {
            needsWrite = true;
            vault.vault[i].ssoProvider[j].username = "";
          }
        }
      }
    }
  }

  if (vault.manualItems !== undefined) {
    for (let i = 0; i < vault.manualItems.length; i++) {
      if (vault.manualItems[i].ssoProvider !== undefined) {
        for (let j = 0; j < vault.manualItems[i].ssoProvider.length; j++) {
          if (vault.manualItems[i].ssoProvider[j].base !== undefined) {
            needsWrite = true;
            vault.manualItems[i].ssoProvider.splice(j, 1);
            continue;
          }

          if (Object.keys(vault.manualItems[i].ssoProvider[j]).length !== 3) {
            needsWrite = true;
            const newProvider = {
              default: vault.manualItems[i].ssoProvider[j].default,
              provider: vault.manualItems[i].ssoProvider[j].provider,
              username: vault.manualItems[i].ssoProvider[j].username,
            };

            vault.manualItems[i].ssoProvider[j] = newProvider;
          }

          if (
            vault.manualItems[i].ssoProvider[j].default === null ||
            vault.manualItems[i].ssoProvider[j].default === undefined
          ) {
            needsWrite = true;
            vault.manualItems[i].ssoProvider[j].default = false;
          }

          if (
            vault.manualItems[i].ssoProvider[j].provider === null ||
            vault.manualItems[i].ssoProvider[j].provider === undefined
          ) {
            needsWrite = true;
            vault.manualItems[i].ssoProvider[j].provider = "";
          }

          if (
            vault.manualItems[i].ssoProvider[j].username === null ||
            vault.manualItems[i].ssoProvider[j].username === undefined
          ) {
            needsWrite = true;
            vault.manualItems[i].ssoProvider[j].username = "";
          }
        }
      }
    }
  }

  return [vault, needsWrite];
}

type MigrationResult = [vault: any, neesWrite: boolean];

export function migrateNext(vault: any): MigrationResult {
  if (vault.vaultSchemaMajor == undefined) {
    return [v0_v1(vault), true];
  }

  switch (vault.vaultSchemaMajor) {
    case 0:
      return [v0_v1(vault), true];
    case 1:
      return [v1_v2(vault), true];
    case 2:
      return [v2_v3(vault), true];
    case 3:
      return [v3_v4(vault), true];
    case 4:
      return [v4_v5(vault), true];
    case 5:
      return [v5_v6(vault), true];
    case 6:
      return [v6_v7(vault), true];
    case 7:
      return hotfix_62723(vault);
    default:
      return [vault, false];
  }
}

export function maybeMigrateVault(vault: any): MigrationResult {
  let result = vault;
  let needsMigration = true;
  let needsWrite = false;

  while (needsMigration) {
    [result, needsMigration] = migrateNext(result);
    if (needsWrite == false) {
      needsWrite = needsMigration;
    }
  }

  return [result, needsWrite];
}
