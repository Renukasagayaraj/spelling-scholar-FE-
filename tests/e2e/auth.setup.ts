import { test as setup, expect } from '@playwright/test';

const authFile = './tests/e2e/.auth/user.json';
const E2E_EMAIL = process.env.E2E_USER_EMAIL || "renuka.sagayaraj@gbritsolutions.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || "renuka@1234";

setup('authenticate', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the app to render before checking visibility
  await expect(page.getByText(/Master every word/)).toBeVisible();

  const signInTitle = page.getByTitle("Sign in");
  const signInBtn = page.getByRole("button", { name: "Sign in", exact: true });
  
  // Since this is a fresh context, we should always be unauthenticated
  // and we should wait for the sign in button to be attached/visible
  await expect(signInTitle.or(signInBtn)).toBeVisible();
  await (await signInTitle.isVisible() ? signInTitle : signInBtn).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Verify successful login
  await expect(page.getByTitle("View Account Profile")).toBeVisible();

  // Save storage state to be used by all other tests
  await page.context().storageState({ path: authFile });
});
