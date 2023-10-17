import { maybeMigrateVault, migrateNext } from "./migrations";

test("maybeMigrateVault", () => {
  // run all the way to latest schema
  const old_vault = {};

  const [new_vault, needsWrite] = maybeMigrateVault(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(7);
  expect(new_vault.vault).toEqual([]);
  expect(new_vault.manualItems).toEqual([]);

  expect(needsWrite).toBe(true);
});

test("v0_v1", () => {
  let old_vault = {};
  let [new_vault, needsMore] = migrateNext(old_vault);

  expect(needsMore).toBe(true);
  expect(new_vault.vaultSchemaMajor).toEqual(1);
  expect(new_vault.vault).toEqual([]);
  expect(new_vault.manualItems).toEqual([]);

  old_vault = { vaultSchemaMajor: 0 };
  [new_vault, needsMore] = migrateNext(old_vault);

  expect(needsMore).toBe(true);
  expect(new_vault.vaultSchemaMajor).toEqual(1);
  expect(new_vault.vault).toEqual([]);
  expect(new_vault.manualItems).toEqual([]);
});

test("v1_v2", () => {
  const old_vault = { vaultSchemaMajor: 1 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(2);
  expect(needsMore).toBe(true);
});

test("v2_v3", () => {
  const old_vault = { vaultSchemaMajor: 2 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(3);
  expect(needsMore).toBe(true);
});

test("v3_v4", () => {
  const old_vault = { vaultSchemaMajor: 3 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(4);
  expect(needsMore).toBe(true);
});

test("v4_v5", () => {
  const old_vault = { vaultSchemaMajor: 4 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(5);
  expect(needsMore).toBe(true);
});

test("v5_v6", () => {
  const old_vault = { vaultSchemaMajor: 5 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(6);
  expect(needsMore).toBe(true);
});

test("v6_v7", () => {
  const old_vault = { vaultSchemaMajor: 6 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(new_vault.vaultSchemaMajor).toEqual(7);
  expect(needsMore).toBe(true);
});

test("latest", () => {
  const old_vault = { vaultSchemaMajor: 7 };
  const [new_vault, needsMore] = migrateNext(old_vault);

  expect(needsMore).toBe(false);
});

describe("hotfix_62723", () => {
  test("vault.vault", () => {
    const old_vault = { vaultSchemaMajor: 7 };

    let [result, needsWrite] = migrateNext(old_vault);
    expect(needsWrite).toBe(false);

    {
      result.vault = [];
      result.vault.push({
        name: "untouched",
      });

      {
        result.vault.push({ ssoProvider: [] });
        result.vault[1].ssoProvider.push({ base: { provider: "invalid" } });
        result.vault[1].ssoProvider.push({ provider: "valid1" });
        result.vault[1].ssoProvider.push({ base: { provider: "invalid" } });
        result.vault[1].ssoProvider.push({ provider: "valid2" });
        result.vault[1].ssoProvider.push({ base: { provider: "invalid" } });

        [result, needsWrite] = migrateNext(result);

        expect(needsWrite).toBe(true);
        expect(result.vault[1].ssoProvider.length).toEqual(2);
        expect(result.vault[1].ssoProvider[0].provider).toEqual("valid1");
        expect(result.vault[1].ssoProvider[1].provider).toEqual("valid2");

        result.vault.pop();
      }

      {
        result.vault.push({
          ssoProvider: [
            {
              default: false,
              provider: "something",
              username: "somethingelse",
              additional: "wrong",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(Object.keys(result.vault[1].ssoProvider[0]).length).toEqual(3);

        result.vault.pop();
      }

      {
        result.vault.push({
          ssoProvider: [
            {
              default: null,
              provider: "something",
              username: "somethingelse",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(result.vault[1].ssoProvider[0].default).toBe(false);

        result.vault.pop();
      }

      {
        result.vault.push({
          ssoProvider: [
            {
              default: true,
              provider: null,
              username: "somethingelse",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(result.vault[1].ssoProvider[0].provider).toEqual("");

        result.vault.pop();
      }

      {
        result.vault.push({
          ssoProvider: [
            {
              default: null,
              provider: null,
              username: null,
              somethingfield: "extra",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(result.vault[1].ssoProvider[0].provider).toEqual("");
        expect(result.vault[1].ssoProvider[0].username).toEqual("");
        expect(result.vault[1].ssoProvider[0].default).toBe(false);
        expect(Object.keys(result.vault[1].ssoProvider[0]).length).toEqual(3);
        expect(result.vault[0].name).toEqual("untouched");
      }

      {
        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(false);
      }
    }
  });

  test("vault.manualItems", () => {
    const old_vault = { vaultSchemaMajor: 7 };

    let [result, needsWrite] = migrateNext(old_vault);
    expect(needsWrite).toBe(false);

    {
      result.manualItems = [];
      result.manualItems.push({
        name: "untouched",
      });

      {
        result.manualItems.push({ ssoProvider: [] });
        result.manualItems[1].ssoProvider.push({
          base: { provider: "invalid" },
        });
        result.manualItems[1].ssoProvider.push({ provider: "valid1" });
        result.manualItems[1].ssoProvider.push({
          base: { provider: "invalid" },
        });
        result.manualItems[1].ssoProvider.push({ provider: "valid2" });
        result.manualItems[1].ssoProvider.push({
          base: { provider: "invalid" },
        });

        [result, needsWrite] = migrateNext(result);

        expect(needsWrite).toBe(true);
        expect(result.manualItems[1].ssoProvider.length).toEqual(2);
        expect(result.manualItems[1].ssoProvider[0].provider).toEqual("valid1");
        expect(result.manualItems[1].ssoProvider[1].provider).toEqual("valid2");

        result.manualItems.pop();
      }

      {
        result.manualItems.push({
          ssoProvider: [
            {
              default: false,
              provider: "something",
              username: "somethingelse",
              additional: "wrong",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(Object.keys(result.manualItems[1].ssoProvider[0]).length).toEqual(3);

        result.manualItems.pop();
      }

      {
        result.manualItems.push({
          ssoProvider: [
            {
              default: null,
              provider: "something",
              username: "somethingelse",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(result.manualItems[1].ssoProvider[0].default).toBe(false);

        result.manualItems.pop();
      }

      {
        result.manualItems.push({
          ssoProvider: [
            {
              default: true,
              provider: null,
              username: "somethingelse",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(result.manualItems[1].ssoProvider[0].provider).toEqual("");

        result.manualItems.pop();
      }

      {
        result.manualItems.push({
          ssoProvider: [
            {
              default: null,
              provider: null,
              username: null,
              somethingfield: "extra",
            },
          ],
        });

        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(true);
        expect(result.manualItems[1].ssoProvider[0].provider).toEqual("");
        expect(result.manualItems[1].ssoProvider[0].username).toEqual("");
        expect(result.manualItems[1].ssoProvider[0].default).toBe(false);
        expect(Object.keys(result.manualItems[1].ssoProvider[0]).length).toEqual(3);
        expect(result.manualItems[0].name).toEqual("untouched");
      }

      {
        [result, needsWrite] = migrateNext(result);
        expect(needsWrite).toBe(false);
      }
    }
  });
});
