import { test, expect, Page } from "@playwright/test";

async function getTargetWord(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Show Debug/ }).click();
  const preText = await page.locator("pre").first().innerText();
  const wordData = JSON.parse(preText);
  await page.getByRole("button", { name: /Hide Debug/ }).click();
  return wordData.word;
}

test.describe("Journey 2: Standard Practice & V2 Progressive Streaming", () => {
  const gradeBands = [
    { label: "Grades 1–3", levelName: "Beginner" },
    { label: "Grades 4–6", levelName: "Intermediate" },
    { label: "Grades 7–9", levelName: "Advanced" },
  ];

  for (const band of gradeBands) {
    test(`standard practice flow for ${band.label} (${band.levelName})`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();

      await page.addLocatorHandler(
        page.getByRole("alertdialog", { name: "Active Session In Progress" }),
        async () => {
          await page.getByRole("button", { name: "Stop Current And Start New" }).click();
        }
      );

      // Open Standard Practice category
      await page.getByRole("button", { name: /Standard Practice/ }).click();
      await expect(page.getByText("CHOOSE YOUR LEVEL")).toBeVisible();

      // Start session for selected grade band
      await page.getByRole("button", { name: new RegExp(band.label) }).click();
      await page.getByRole("button", { name: "Start Session" }).click();
      await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();
      await expect(page.getByPlaceholder("Type your spelling…")).toBeVisible();

      // Get target word 1 from debug panel
      const firstWord = await getTargetWord(page);

      // 1. Correct Spelling Flow
      await page.getByPlaceholder("Type your spelling…").fill(firstWord);
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.getByText("Correct!")).toBeVisible();
      await expect(page.locator("aside").getByText(firstWord, { exact: true })).toBeVisible();

      // 2. Next Word Transition
      await page.getByRole("button", { name: "Next Word" }).click();
      await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();
      const secondWord = await getTargetWord(page);

      // 3. Incorrect Spelling Flow & AI Streaming Verification
      const wrongSpelling = secondWord.toLowerCase() === "definitelywrong" ? "stillwrong" : "definitelywrong";
      await page.getByPlaceholder("Type your spelling…").fill(wrongSpelling);
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.getByText("Not quite!")).toBeVisible();

      // Verify AI streaming sections
      if (band.label !== "Grades 1–3") {
        await expect(page.getByText("Explanation")).toBeVisible();
      }
      await expect(page.getByText("Memory Tip")).toBeVisible();
      await expect(page.getByRole("button", { name: "Next Word" })).toBeEnabled();

      // 4. Verify History Selection & Restoration
      await page.locator("aside").getByText(firstWord, { exact: true }).click();
      await expect(page.getByText("Correct!")).toBeVisible();

      // 5. Clean Session Completion / Return to Home
      await page.getByRole("button", { name: "Go Back", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();
    });
  }
});
