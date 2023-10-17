import { E2E } from "../client";
import { test, expect } from "../fixtures";

test.describe("Command Menu", () => {
  test("Open command menu", async ({ page, initializeTestUser, orchestratorInitialized }) => {
    await initializeTestUser();

    await page.goto("https://google.com");
    await orchestratorInitialized();

    await expect(page.getByTestId(E2E.TestID.CommandMenu)).toBeHidden();
    await page.keyboard.press("Meta+Shift+K");
    await expect(page.getByTestId(E2E.TestID.CommandMenu)).toBeVisible();
  });
});
