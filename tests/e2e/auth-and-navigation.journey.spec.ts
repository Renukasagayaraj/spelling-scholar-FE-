import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL || "renuka.sagayaraj@gbritsolutions.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || "renuka@1234";

test.describe("Journey 1: Authentication & Navigation Integrity", () => {
  // Use unauthenticated storageState for sign in modal testing
  test.use({ storageState: { cookies: [], origins: [] } });

  test("user sign in, invalid credential feedback, and session persistence", async ({ page }) => {
    // 1. Open home page in unauthenticated state
    await page.goto("/");
    await expect(page.getByText(/Master every word/)).toBeVisible();

    // Open Sign in modal
    const signInTitle = page.getByTitle("Sign in");
    const signInBtn = page.getByRole("button", { name: "Sign in", exact: true });
    await (await signInTitle.isVisible() ? signInTitle : signInBtn).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // 2. Invalid Password handling
    await page.locator('input[type="email"]').fill(E2E_EMAIL);
    await page.locator('input[type="password"]').fill("intentionally-invalid-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".text-destructive")).toBeVisible();

    // 3. Valid Sign In
    await page.locator('input[type="email"]').fill(E2E_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByTitle("View Account Profile")).toBeVisible();

    // 4. Reload preserves authenticated state
    await page.reload();
    await expect(page.getByTitle("View Account Profile")).toBeVisible();
  });

  test("profile navigation, browser Back, and second tab restore", async ({ page, context }) => {
    await page.goto("/");
    const signInTitle = page.getByTitle("Sign in");
    const signInBtn = page.getByRole("button", { name: "Sign in", exact: true });

    if (await signInTitle.isVisible() || await signInBtn.isVisible()) {
      await (await signInTitle.isVisible() ? signInTitle : signInBtn).click();
      await page.locator('input[type="email"]').fill(E2E_EMAIL);
      await page.locator('input[type="password"]').fill(E2E_PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
    }

    await expect(page.getByTitle("View Account Profile")).toBeVisible();

    // Navigate to Profile
    await page.getByTitle("View Account Profile").click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();

    // Browser Back
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/Master every word/)).toBeVisible();

    // Open second tab - should restore authenticated state automatically
    const secondTab = await context.newPage();
    await secondTab.goto("/");
    await expect(secondTab.getByTitle("View Account Profile")).toBeVisible();
    await expect(secondTab.getByText(/Master every word/)).toBeVisible();
    await secondTab.close();
  });
});
