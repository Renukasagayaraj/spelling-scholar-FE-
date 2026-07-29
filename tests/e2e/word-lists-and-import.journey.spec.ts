import { test, expect, Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL || "renuka.sagayaraj@gbritsolutions.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || "renuka@1234";

async function prepareSubscription(page: Page) {
  let customLists: any[] = [];
  let importFileCallCount = 0;

  await page.route("**/api/custom-lists", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lists: customLists }),
    });
  });

  await page.route("**/api/custom-lists/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-list-id",
        name: "Mock List",
        words: [
          {
            word: "friend",
            level: "custom",
            grade_band: "custom",
            difficulty: "custom",
            origin: "Old English",
            definition: "A person whom one knows and will have a bond of mutual affection.",
            example_sentence: "She is my best friend.",
            part_of_speech: "noun",
            patterns: [],
            common_mistakes: [],
            coach_tip: ""
          },
          {
            word: "school",
            level: "custom",
            grade_band: "custom",
            difficulty: "custom",
            origin: "Greek",
            definition: "An institution for educating children.",
            example_sentence: "I go to school every day.",
            part_of_speech: "noun",
            patterns: [],
            common_mistakes: [],
            coach_tip: ""
          }
        ]
      }),
    });
  });

  await page.route("**/api/words/import-file", async (route) => {
    importFileCallCount++;
    if (importFileCallCount === 1) {
      customLists.push({
        id: "csv-list-id",
        name: "Journey File Import List",
        level: "custom",
        wordCount: 2
      });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          status: "processing_in_background",
          jobId: "csv-job",
          listName: "Journey File Import List",
          detectedWords: 2,
          filename: "Journey File Import List.csv"
        }),
      });
    } else {
      customLists.push({
        id: "txt-list-id",
        name: "Journey TXT Import List",
        level: "custom",
        wordCount: 2
      });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          status: "processing_in_background",
          jobId: "txt-job",
          listName: "Journey TXT Import List",
          detectedWords: 2,
          filename: "Journey TXT Import List.txt"
        }),
      });
    }
  });

  await page.route("**/api/words/import-jobs/*", async (route) => {
    const url = route.request().url();
    const jobId = url.split("/").pop();
    const name = jobId === "csv-job" ? "Journey File Import List" : "Journey TXT Import List";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "done",
        result: {
          list: {
            id: jobId === "csv-job" ? "csv-list-id" : "txt-list-id",
            name: name,
            wordCount: 2
          },
          importedCount: 2,
          skippedExistingCount: 0,
          words: []
        }
      }),
    });
  });

  await page.route("**/api/words/import-custom", async (route) => {
    customLists.push({
      id: "manual-list-id",
      name: "Journey Manual List",
      level: "custom",
      wordCount: 2
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        list: {
          id: "manual-list-id",
          name: "Journey Manual List",
          wordCount: 2
        },
        importedCount: 2,
        skippedExistingCount: 0
      }),
    });
  });

  await page.route("**/api/spelling-coach/stream", async (route) => {
    const postData = JSON.parse(route.request().postData() || "{}");
    const isCorrect = postData.childAttempt?.toLowerCase() === postData.targetWord?.toLowerCase();

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        'event: meta',
        `data: {"requestId":"mock-id","isCorrect":${isCorrect},"timingMs":1,"targetWordMasked":true,"missAnalysis":{"correctSpellings":[],"graphemeMatches":[],"missType":"substitution"}}`,
        '',
        'event: section-start',
        'data: {"section":"explanation","timingMs":2}',
        '',
        'event: section-chunk',
        'data: {"section":"explanation","text":"This is a mock description of the word spelling patterns.","timingMs":3}',
        '',
        'event: section-complete',
        'data: {"section":"explanation","timingMs":4}',
        '',
        'event: section-start',
        'data: {"section":"memory_tip","timingMs":5}',
        '',
        'event: section-chunk',
        'data: {"section":"memory_tip","text":"This is a mock tip for memorizing the spelling.","timingMs":6}',
        '',
        'event: section-complete',
        'data: {"section":"memory_tip","timingMs":7}',
        '',
        'event: done',
        'data: {"complete":true}',
        ''
      ].join('\n'),
    });
  });

  let nextWordCallCount = 0;

  await page.route("**/api/sessions/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ action: "created", sessionId: "mock-session-id" }),
    });
  });

  await page.route("**/api/sessions/current*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "mock-session-id",
          mode: "custom_practice",
          custom_list_id: "manual-list-id",
          custom_list_name: "Journey Manual List",
          session_started_at: "2026-07-28T10:00:00.000Z",
          session_ended_at: null,
          total_words_attempted: 0,
          total_correct: 0
        }
      }),
    });
  });

  await page.route("**/api/sessions/attempts*", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ attemptId: "attempt-1" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ attempts: [] }),
      });
    }
  });

  await page.route("**/api/sessions/end", async (route) => {
    await route.fulfill({ status: 200 });
  });

  await page.route("**/api/words/next*", async (route) => {
    nextWordCallCount++;
    const word = nextWordCallCount === 1 ? "friend" : "school";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        word,
        level: "custom",
        grade_band: "custom",
        difficulty: "custom",
        origin: "Old English",
        definition: "Mock definition for E2E testing.",
        example_sentence: `This is a mock sentence using the word ${word}.`,
        part_of_speech: "noun",
        patterns: [],
        common_mistakes: [],
        coach_tip: ""
      }),
    });
  });

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

const textListName = "Journey Manual List";
const csvListName = "Journey File Import List";
const txtListName = "Journey TXT Import List";

test.describe("Journey 3: Custom Word Lists & File Import", () => {
  test("manual list creation, file import validation, duplicate import, custom practice with correct & incorrect spelling", async ({ page }) => {
    await prepareSubscription(page);

    // 1. Navigate to Word Lists
    const myWordListsCard = page.getByRole("button", { name: /My Word Lists/ });
    await expect(myWordListsCard).toBeVisible();
    await myWordListsCard.click();

    // Verify Custom List Panel loaded
    await expect(page.getByText("Your Word Lists")).toBeVisible();

    // 2. Invalid file extension validation
    await page.locator('input[type="file"]').setInputFiles({
      name: "invalid.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("friend"),
    });
    await expect(page.getByRole("alert")).toContainText("Please select a .txt or .csv file");

    // 3. CSV File upload & deduplication
    await page.locator('input[type="file"]').setInputFiles({
      name: "Journey File Import List.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("word,notes\nfriend,first\nFRIEND,duplicate\nschool,second\n"),
    });
    await expect(page.getByText(`File imported as "${csvListName}"`)).toBeVisible();

    const importedCsvItem = page.getByRole("button", { name: new RegExp(csvListName) }).first();
    await expect(importedCsvItem).toContainText("2 words");
    await importedCsvItem.click();
    await expect(page.getByText("friend, school", { exact: true })).toBeVisible();

    // 4. TXT File upload
    await page.locator('input[type="file"]').setInputFiles({
      name: "Journey TXT Import List.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("pistachio\nditto\n"),
    });
    await expect(page.getByText(`File imported as "${txtListName}"`)).toBeVisible();

    // 5. Manual List Creation / Import Form
    await page.getByRole("button", { name: "Import New List" }).click();
    await page.locator('input[placeholder="e.g. Wind Words"]').fill(textListName);
    await page.locator("textarea").fill("friend\nschool");
    await page.getByRole("button", { name: "Import List", exact: true }).click();
    await expect(page.getByText(`List "${textListName}" imported`)).toBeVisible();

    // 6. Select list and expand details
    const manualListItem = page.getByRole("button", { name: new RegExp(textListName) }).first();
    await manualListItem.click();
    await expect(page.getByText("friend, school", { exact: true })).toBeVisible();

    // 7. Start Custom Practice
    await page.getByRole("button", { name: `Practice "${textListName}"` }).click();
    await expect(page.getByRole("button", { name: "Hear the Word" })).toBeVisible();

    // 8. Correct Spelling Flow
    const word1 = await getTargetWord(page);
    await page.getByPlaceholder("Type your spelling…").fill(word1);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Correct!")).toBeVisible();

    // 9. Next Word & Incorrect Spelling Flow
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

    // 10. Return to Dashboard cleanly
    await page.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Master every word/ })).toBeVisible();
  });
});
