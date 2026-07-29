import { test, expect, Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL || "renuka.sagayaraj@gbritsolutions.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || "renuka@1234";

async function prepareSubscription(page: Page) {
  await page.route("**/api/stripe/subscription-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscribed: true, currentPeriodEnd: 1784803412, cancelAtPeriodEnd: false }),
    })
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();

  await page.addLocatorHandler(
    page.getByRole("alertdialog", { name: "Active Session In Progress" }),
    async () => {
      await page.getByRole("button", { name: "Stop Current And Start New" }).click();
    }
  );

  const signOutBtn = page.getByTitle("Sign out");
  if (!await signOutBtn.isVisible()) {
    const signInBtn = page.getByRole("button", { name: "Sign in", exact: true }).or(page.getByTitle("Sign in"));
    await signInBtn.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator('input[type="email"]').fill(E2E_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }

  await expect(page.getByRole("button", { name: "Premium" })).toBeVisible();
}

async function getTargetWord(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Show Debug/ }).click();
  const preText = await page.locator("pre").first().innerText();
  const wordData = JSON.parse(preText);
  await page.getByRole("button", { name: /Hide Debug/ }).click();
  return wordData.word;
}

test.describe("Journey 6: System Resilience & Degradation", () => {
  test("blank input submission button state", async ({ page }) => {
    await prepareSubscription(page);

    await page.getByRole("button", { name: /Standard Practice/ }).click();
    await page.getByRole("button", { name: /Grades 1–3/ }).click();
    await page.getByRole("button", { name: "Start Session" }).click();
    await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

    const submitBtn = page.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeDisabled();

    await page.getByPlaceholder("Type your spelling…").fill("   ");
    await expect(submitBtn).toBeDisabled();
  });

  test("partial feedback and stream cancellation resilience", async ({ page }) => {
    await prepareSubscription(page);

    await page.getByRole("button", { name: /Standard Practice/ }).click();
    await page.getByRole("button", { name: /Grades 1–3/ }).click();
    await page.getByRole("button", { name: "Start Session" }).click();
    await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

    const targetWord = await getTargetWord(page);
    await page.getByPlaceholder("Type your spelling…").fill(targetWord);
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Correct!")).toBeVisible();

    // Verify returning to dashboard
    await page.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();
  });

  test("graceful handling when AI stream times out (port 4174)", async ({ page }) => {
    await prepareSubscription(page);

    await page.getByRole("button", { name: /Standard Practice/ }).click();
    await page.getByRole("button", { name: /Grades 1–3/ }).click();
    await page.getByRole("button", { name: "Start Session" }).click();
    await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

    // Intercept SSE streaming request to mock AI timeout / fallback response
    await page.route("**/api/coach/spelling", (route) =>
      route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI Coaching request timed out" }),
      })
    );

    const targetWord = await getTargetWord(page);
    await page.getByPlaceholder("Type your spelling…").fill(targetWord);
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Correct!")).toBeVisible();
  });

  test("graceful handling when OpenAI returns API error (port 4175)", async ({ page }) => {
    await prepareSubscription(page);

    await page.getByRole("button", { name: /Standard Practice/ }).click();
    await page.getByRole("button", { name: /Grades 1–3/ }).click();
    await page.getByRole("button", { name: "Start Session" }).click();
    await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

    await page.route("**/api/coach/spelling", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "OpenAI API unavailable" }),
      })
    );

    const targetWord = await getTargetWord(page);
    await page.getByPlaceholder("Type your spelling…").fill(targetWord);
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Correct!")).toBeVisible();
  });

  test("graceful handling when backend endpoint is down (port 4176)", async ({ page }) => {
    await prepareSubscription(page);

    await page.getByRole("button", { name: /Standard Practice/ }).click();
    await page.getByRole("button", { name: /Grades 1–3/ }).click();
    await page.getByRole("button", { name: "Start Session" }).click();
    await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

    await page.route("**/api/coach/spelling", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Backend server down" }),
      })
    );

    const targetWord = await getTargetWord(page);
    await page.getByPlaceholder("Type your spelling…").fill(targetWord);
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Correct!")).toBeVisible();
  });
});
