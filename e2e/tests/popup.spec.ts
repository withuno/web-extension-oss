import { TestVaults } from "e2e/fixtures/vaults";

import { E2E } from "../client";
import { test, expect } from "../fixtures";

test.describe("Popup", () => {
  test("Popup renders", async ({ openExtensionPage, initializeTestUser }) => {
    await initializeTestUser();
    const popupPage = await openExtensionPage("popup.html");
    await expect(popupPage.getByTestId(E2E.TestID.PopupRoot)).toBeVisible();
  });

  test.describe("Vault item CRUD operations", () => {
    test("Login item: ADD", async ({
      page,
      initializeTestUser,
      orchestratorInitialized,
      openExtensionPopup,
      waitForSignedBackendResponse,
      getVaultData,
      getVaultID,
    }) => {
      // Set up a test user, navigate to Google, and wait for orchestrator
      // initialization.
      await initializeTestUser();
      await page.goto("https://google.com");
      await orchestratorInitialized();

      // Open the popup and get the test user's vault ID.
      const popupPage = await openExtensionPopup();
      const vaultID = await getVaultID();

      // Navigate to the "Add Login Item" form.
      await popupPage.getByTestId(E2E.TestID.PopupIndexAddVaultItemButton).click();
      await popupPage.getByTestId(E2E.TestID.PopupIndexAddLoginItemButton).click();
      await expect(popupPage.getByTestId(E2E.TestID.LoginItemFormRoot)).toBeVisible();

      // Set-up some expected values. We'll assert these after we create the
      // login item.
      const expectedUrl = "www.google.com";
      const expectedUsername = "test+login_item_add@uno.app";
      const expectedPassword = "test_password";

      // Create a new login item with `expectedUsername` and `expectedPassword`.
      await popupPage.getByTestId(E2E.TestID.LoginItemFormUsernameField).type(expectedUsername);
      await popupPage.getByTestId(E2E.TestID.LoginItemFormPasswordField).type(expectedPassword);
      await popupPage.getByTestId(E2E.TestID.LoginItemFormSaveButton).click();

      // Wait for the new login item to be saved in Uno's backend.
      const saveRes = await waitForSignedBackendResponse({
        endpoint: `/v2/vaults/${vaultID}`,
        method: "PUT",
      });
      expect(saveRes.ok()).toBeTruthy();

      // Check that our test vault contains the expected data.
      const vaultData = await getVaultData();
      expect(vaultData.manualItems[0].url).toBe(expectedUrl);
      expect(vaultData.manualItems[0].username).toBe(expectedUsername);
      expect(vaultData.manualItems[0].password).toBe(expectedPassword);
    });

    test("Login item: EDIT", async ({
      page,
      initializeTestUser,
      orchestratorInitialized,
      openExtensionPopup,
      injectVaultData,
      waitForSignedBackendResponse,
      getVaultData,
      getVaultID,
    }) => {
      // Set up a test user, navigate to Google, and wait for orchestrator
      // initialization.
      const testUser = await initializeTestUser();
      await page.goto("https://google.com");
      await orchestratorInitialized();

      // Inject sample vault data.
      const testVault = TestVaults.V7.withGoogleLogin(testUser);
      const injectedVault = await injectVaultData(testVault);
      expect(testVault.manualItems[0]).toEqual(injectedVault.manualItems[0]);

      // Open the popup and get the test user's vault ID.
      const popupPage = await openExtensionPopup();
      const vaultID = await getVaultID();

      // Navigate to the edit form for the sample login item.
      await popupPage.getByTestId(injectedVault.manualItems[0].id).click();
      await popupPage.getByTestId(E2E.TestID.LoginItemEditButton).click();

      // Set-up some new expected values. We'll assert these after we edit the
      // login item.
      const expectedNewUsername = "test+new_username@uno.app";
      const expectedNewPassword = "new_test_password";

      // Clear the old username and password.
      await popupPage.getByTestId(E2E.TestID.LoginItemFormUsernameField).clear();
      await popupPage.getByTestId(E2E.TestID.LoginItemFormPasswordField).clear();

      // Enter the new username and password, then save.
      await popupPage.getByTestId(E2E.TestID.LoginItemFormUsernameField).type(expectedNewUsername);
      await popupPage.getByTestId(E2E.TestID.LoginItemFormPasswordField).type(expectedNewPassword);
      await popupPage.getByTestId(E2E.TestID.LoginItemFormSaveButton).click();

      // Wait for the edited login item to be saved in Uno's backend.
      const saveRes = await waitForSignedBackendResponse({
        endpoint: `/v2/vaults/${vaultID}`,
        method: "PUT",
      });
      expect(saveRes.ok()).toBeTruthy();

      // Check that our test vault contains the expected data.
      const vaultData = await getVaultData();
      expect(vaultData.manualItems[0].username).toBe(expectedNewUsername);
      expect(vaultData.manualItems[0].password).toBe(expectedNewPassword);
    });

    test("Login item: DELETE", async ({
      page,
      initializeTestUser,
      orchestratorInitialized,
      openExtensionPopup,
      injectVaultData,
      waitForSignedBackendResponse,
      getVaultData,
      getVaultID,
    }) => {
      // Set up a test user, navigate to Google, and wait for orchestrator
      // initialization.
      const testUser = await initializeTestUser();
      await page.goto("https://google.com");
      await orchestratorInitialized();

      // Inject sample vault data.
      const testVault = TestVaults.V7.withGoogleLogin(testUser);
      const injectedVault = await injectVaultData(testVault);
      expect(testVault.manualItems[0]).toEqual(injectedVault.manualItems[0]);

      // Open the popup and get the test user's vault ID.
      const popupPage = await openExtensionPopup();
      const vaultID = await getVaultID();

      // Navigate to the edit form for the sample login item.
      await popupPage.getByTestId(injectedVault.manualItems[0].id).click();
      await popupPage.getByTestId(E2E.TestID.LoginItemEditButton).click();

      // Click delete, then confirm delete.
      await popupPage.getByTestId(E2E.TestID.LoginItemDeleteButton).click();
      await popupPage.getByTestId(E2E.TestID.PopupConfirmDeleteButton).click();

      // Wait for the edited login item to be saved in Uno's backend.
      const saveRes = await waitForSignedBackendResponse({
        endpoint: `/v2/vaults/${vaultID}`,
        method: "PUT",
      });
      expect(saveRes.ok()).toBeTruthy();

      // Check that our test vault contains the expected data.
      const vaultData = await getVaultData();
      expect(vaultData.manualItems.length).toBe(0);
    });
  });
});
