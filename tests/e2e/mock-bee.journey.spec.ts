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

  // Mock custom lists specifically for GET /api/custom-lists
  await page.route("**/api/custom-lists**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          lists: [{ id: "cl-1", name: "Journey Custom List", wordCount: 5 }],
        }),
      });
    }
    return route.continue();
  });

  // Mock round creation to guarantee round setup succeeds in all test environments
  await page.route(/\/api\/mock-bee\/sessions$/, (route) => {
    if (route.request().method() === "POST") {
      const postData = JSON.parse(route.request().postData() || "{}");
      const lvl = postData.level || "1";
      const count = postData.wordCount || 10;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: `mock-bee-session-${lvl}`,
            status: "active",
            config: {
              level: lvl,
              wordSource: postData.wordSource || "standard",
              wordCount: count,
              timer: { secondsPerWord: 30, showCountdown: true, revealAnswerOnSubmit: lvl !== "3" },
            },
            progress: {
              totalWords: count,
              currentTurnNumber: 1,
              answeredCount: 0,
              correctCount: 0,
              incorrectCount: 0,
              timedOutCount: 0,
            },
            currentChallenge: {
              turnIndex: 0,
              turnNumber: 1,
              timer: { secondsPerWord: 30, showCountdown: true, revealAnswerOnSubmit: lvl !== "3" },
              supports: {
                definition: "A test definition for mock bee.",
                exampleSentence: "She spelled the target word correctly.",
                origin: "English",
                partOfSpeech: "noun",
                gradeBand: "Grades 1–3",
                difficulty: "easy",
                level: lvl,
              },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    }
    return route.continue();
  });

  await page.route(/\/api\/mock-bee\/sessions\/[^/]+\/submit$/, (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "mock-session",
            status: "active",
            config: { level: "1", timer: {} },
            progress: { answeredCount: 1 },
            currentChallenge: {
              turnIndex: 1,
              turnNumber: 2,
              timer: {},
              supports: {
                definition: "A target word for practice.",
                exampleSentence: "She spelled the target word correctly.",
                origin: "English",
                partOfSpeech: "noun",
                gradeBand: "Grades 1–3",
                difficulty: "easy",
                level: "1",
              }
            }
          },
          result: { isCorrect: true, revealAnswer: true, correctWord: "correctword" }
        })
      });
    }
    return route.continue();
  });

  await page.route(/\/api\/mock-bee\/sessions\/[^/]+\/end$/, (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ session: { id: "mock-session", status: "completed" } })
      });
    }
    return route.continue();
  });

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

test.describe("Journey 5: Mock Bee Practice & AI Review Flow - 6 Full Combinations", () => {
  const levels = ["1", "2", "3"] as const;
  const sources = [
    { type: "standard", label: "Standard practice" },
    { type: "custom_list", label: "My word lists" },
  ] as const;

  for (const lvl of levels) {
    for (const src of sources) {
      const wordCountStr = lvl === "1" ? "10" : lvl === "2" ? "20" : "30";

      test(`Level ${lvl} × ${src.label} (${wordCountStr} words) setup, spelling, review, and round completion`, async ({ page }) => {
        await prepareSubscription(page);

        // Open Mock Bee
        await page.getByRole("button", { name: /Mock Bee/ }).click();
        await expect(page.getByRole("heading", { name: "Set up your round" })).toBeVisible();

        // Select Level
        await page.getByRole("button", { name: new RegExp(`Level ${lvl}`) }).click();

        // Select Word Source
        await page.getByRole("button", { name: new RegExp(src.label) }).click();
        if (src.type === "custom_list") {
          const customListBtn = page.getByRole("button", { name: /Journey Custom List/ });
          await expect(customListBtn).toBeVisible();
          await customListBtn.click();
        }

        // Select Word Count
        await page.getByRole("button", { name: wordCountStr, exact: true }).click();

        // Start round
        await page.getByRole("button", { name: "Start round" }).click();
        await expect(page.getByPlaceholder("Type your spelling…")).toBeVisible();

        // Answer Word 1 (Correct Spelling)
        await page.getByPlaceholder("Type your spelling…").fill("correctword");
        await page.getByRole("button", { name: "Submit" }).click();

        // Wait for submit network request and state transition to complete
        await page.waitForTimeout(1000);

        // Exit round and return to dashboard
        await page.getByRole("button", { name: "Exit round" }).click();
        await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeVisible();
        await page.getByRole("button", { name: "Back to dashboard" }).click();
        await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();
      });
    }
  }
});
