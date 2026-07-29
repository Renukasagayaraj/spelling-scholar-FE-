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

test.describe("Journey 4: Language Origins Practice Flow", () => {
  test("loop through 2 displayed language origins and verify complete practice journey with correct & incorrect spellings", async ({ page }) => {
    await prepareSubscription(page);

    // Initial navigation to inspect language count
    await page.getByRole("button", { name: /Language Origins/ }).click();
    await expect(page.getByRole("heading", { name: "Words by Language Origin" })).toBeVisible();

    const originButtons = page.getByRole("button", { name: /[1-9]\d* words/ });
    const availableCount = await originButtons.count();
    expect(availableCount).toBeGreaterThan(0);

    // Cap loop to test 2 origins as requested
    const testCount = Math.min(2, availableCount);

    // Return to dashboard before starting loop
    await page.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();

    for (let i = 0; i < testCount; i++) {
      // 1. Open Language Origins panel
      await page.getByRole("button", { name: /Language Origins/ }).click();
      await expect(page.getByRole("heading", { name: "Words by Language Origin" })).toBeVisible();

      // 2. Expand origin card at index i
      const currentOriginBtn = page.getByRole("button", { name: /[1-9]\d* words/ }).nth(i);
      await expect(currentOriginBtn).toBeVisible();
      await currentOriginBtn.click();

      // 3. Click Start Practice for this language
      const startBtn = page.getByRole("button", { name: /Start .+ Practice/ });
      await expect(startBtn).toBeVisible();
      await expect(startBtn).toBeEnabled();
      await startBtn.click();

      // 4. Verify practice UI
      await expect(page.getByPlaceholder("Type your spelling…")).toBeVisible();
      await expect(page.getByText(/Practicing .+ origin words/)).toBeVisible();

      // 5. Correct Spelling Flow
      const word1 = await getTargetWord(page);
      await page.getByPlaceholder("Type your spelling…").fill(word1);
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      // 6. Next Word & Incorrect Spelling Flow
      await page.getByRole("button", { name: "Next Word" }).click();
      await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

      const word2 = await getTargetWord(page);
      const wrongSpelling = word2.toLowerCase() === "incorrectword" ? "stillwrong" : "incorrectword";
      await page.getByPlaceholder("Type your spelling…").fill(wrongSpelling);
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.getByText("Not quite!")).toBeVisible();

      // Verify AI streaming feedback sections
      await expect(page.getByText("Explanation")).toBeVisible();
      await expect(page.getByText("Memory Tip")).toBeVisible();

      // 7. Finish session and return to Dashboard
      await page.getByRole("button", { name: "Go Back", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();
    }
  });
});
