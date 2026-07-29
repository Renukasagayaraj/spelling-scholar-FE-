import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getAccessToken: auth.getAccessToken,
  supabase: { auth: { getSession: auth.getSession, signOut: auth.signOut } },
}));

import {
  UnauthorizedError,
  checkHealth,
  createStripeCheckoutSession,
  createStripePortalSession,
  endPracticeSession,
  fetchCustomLists,
  fetchCustomListWords,
  fetchForeignOriginDetails,
  fetchNextWord,
  fetchPracticeSession,
  fetchPronunciationAudio,
  fetchSessionAttempts,
  fetchSubscriptionStatus,
  importCustomWordList,
  invalidateCustomListsCache,
  recordWordAttempt,
  startPracticeSession,
} from "@/lib/api";

const jsonResponse = (data: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: vi.fn().mockResolvedValue(data),
});

const word = {
  word: "rhythm", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Greek",
  definition: "A pattern.", exampleSentence: "Keep the rhythm.", partOfSpeech: "noun",
  pronunciation: "RITH-um", patterns: [],
};

describe("remaining API endpoints", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    auth.getAccessToken.mockReset().mockResolvedValue("access-token");
    auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
    auth.signOut.mockReset().mockResolvedValue(undefined);
    invalidateCustomListsCache();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("checks health and rejects unhealthy responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkHealth()).resolves.toEqual({ status: "ok" });
    await expect(checkHealth()).rejects.toThrow("Health check failed");
  });

  it("builds next-word queries with mode precedence, exclusions, auth, and legacy arguments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(word));
    vi.stubGlobal("fetch", fetchMock);
    await fetchNextWord({ foreignOrigin: "Old French", customListId: "ignored", level: 3, exclude: ["a", "b"] });
    await fetchNextWord({ customListId: "list/one", level: 2 });
    await fetchNextWord(1, "legacy-list");
    await fetchNextWord();

    expect(fetchMock.mock.calls[0][0]).toMatch(/foreignOrigin=Old\+French.*exclude=a%2Cb/);
    expect(fetchMock.mock.calls[0][0]).not.toContain("customListId");
    expect(fetchMock.mock.calls[1][0]).toContain("customListId=list%2Fone");
    expect(fetchMock.mock.calls[1][1]).toEqual({ headers: { Authorization: "Bearer access-token" } });
    expect(fetchMock.mock.calls[2][0]).toContain("customListId=legacy-list");
    expect(fetchMock.mock.calls[3][0]).toMatch(/\/api\/words\/next\?$/);
  });

  it("rejects failed next-word requests when a backend is configured", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 })));
    await expect(fetchNextWord({ level: 2 })).rejects.toThrow("Failed to fetch word");
  });

  it("handles unauthorized responses, signing out an existing local session", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "stale" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 401 })));
    await expect(startPracticeSession({ mode: "standard" })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });

    auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(fetchSessionAttempts("session")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("starts, fetches, records, refreshes, and ends session data", async () => {
    const session = { id: "s/1", mode: "standard" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ action: "created", sessionId: "s/1" }))
      .mockResolvedValueOnce(jsonResponse({ attempts: [{ id: "a1" }] }))
      .mockResolvedValueOnce(jsonResponse({ session }))
      .mockResolvedValueOnce(jsonResponse({ attemptId: "a2" }))
      .mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    await expect(startPracticeSession({ mode: "standard", level: 2 })).resolves.toMatchObject({ action: "created" });
    await expect(fetchSessionAttempts("s/1")).resolves.toEqual([{ id: "a1" }]);
    await expect(fetchPracticeSession("s/1")).resolves.toEqual(session);
    const attempt = {
      sessionId: "s/1", targetWord: "rhythm", childAttempt: "rythm", isCorrect: false,
      level: 2, mode: "standard", definitionViewed: false, exampleViewed: false,
      originViewed: false, partOfSpeechViewed: false, repeatWordCount: 0,
      usedVoiceInput: false, coachingResponse: "{}",
    };
    await expect(recordWordAttempt(attempt)).resolves.toBe("a2");
    await expect(endPracticeSession({ sessionId: "s/1", totalWordsAttempted: 1, totalCorrect: 0, durationSeconds: 10 }, true)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain("sessionId=s%2F1");
    expect(fetchMock.mock.calls[4][1]).toMatchObject({ keepalive: true });
  });

  it.each([
    ["start", () => startPracticeSession({ mode: "standard" }), "Failed to start practice session"],
    ["attempts", () => fetchSessionAttempts("s"), "Failed to fetch session attempts"],
    ["session", () => fetchPracticeSession("s"), "Failed to refresh practice session"],
    ["record", () => recordWordAttempt({ sessionId: "s", targetWord: "a", childAttempt: "b", isCorrect: false, level: 1, mode: "standard", definitionViewed: false, exampleViewed: false, originViewed: false, partOfSpeechViewed: false, repeatWordCount: 0, usedVoiceInput: false, coachingResponse: "{}" }), "Failed to record word attempt"],
    ["end", () => endPracticeSession({ sessionId: "s", totalWordsAttempted: 0, totalCorrect: 0, durationSeconds: 0 }), "Failed to end practice session"],
  ])("rejects failed %s session requests", async (_name, action, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 })));
    await expect(action()).rejects.toThrow(message);
  });

  it("fetches encoded foreign-origin details and reports failures", async () => {
    const detail = { origin: "Old French", wordCount: 1, words: [word] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ origin: detail }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchForeignOriginDetails("Old/French")).resolves.toEqual(detail);
    expect(fetchMock.mock.calls[0][0]).toContain("Old%2FFrench");
    await expect(fetchForeignOriginDetails("missing")).rejects.toThrow("Failed to fetch foreign origin details");
  });

  it("normalizes every custom-list words response shape", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([word]))
      .mockResolvedValueOnce(jsonResponse({ words: [word] }))
      .mockResolvedValueOnce(jsonResponse({ list: { words: [word] } }))
      .mockResolvedValueOnce(jsonResponse({ unexpected: true }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchCustomListWords("raw")).resolves.toEqual([word]);
    await expect(fetchCustomListWords("wrapped")).resolves.toEqual([word]);
    await expect(fetchCustomListWords("nested")).resolves.toEqual([word]);
    await expect(fetchCustomListWords("empty")).resolves.toEqual([]);
    await expect(fetchCustomListWords("bad")).rejects.toThrow("Failed to fetch custom list words");
  });

  it("imports custom lists and invalidates the list cache", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ lists: [] }))
      .mockResolvedValueOnce(jsonResponse({ importedCount: 1, skippedExistingCount: 0, words: [word], list: { id: "l", name: "List", level: "2", wordCount: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ lists: [{ id: "l" }] }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchCustomLists();
    await expect(importCustomWordList({ listName: "List", words: ["rhythm"], overwriteList: false })).resolves.toMatchObject({ importedCount: 1 });
    await expect(fetchCustomLists()).resolves.toEqual({ lists: [{ id: "l" }] });
    await expect(importCustomWordList({ listName: "", words: [], overwriteList: true })).rejects.toThrow("Failed to import custom list");
  });

  it("creates a pronunciation object URL and rejects backend failures", async () => {
    const audio = new Blob(["audio"]);
    const createObjectURL = vi.fn(() => "blob:pronunciation");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => audio })
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchPronunciationAudio("a/b")).resolves.toBe("blob:pronunciation");
    expect(fetchMock.mock.calls[0][0]).toContain("a%2Fb");
    await expect(fetchPronunciationAudio("bad")).rejects.toThrow("Failed to fetch pronunciation");
  });

  it("fetches subscription status and creates Stripe sessions", async () => {
    const status = { subscribed: true, currentPeriodEnd: 100, cancelAtPeriodEnd: false };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(status))
      .mockResolvedValueOnce(jsonResponse({ url: "https://checkout" }))
      .mockResolvedValueOnce(jsonResponse({ url: "https://portal" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSubscriptionStatus()).resolves.toEqual(status);
    await expect(createStripeCheckoutSession()).resolves.toEqual({ url: "https://checkout" });
    await expect(createStripePortalSession()).resolves.toEqual({ url: "https://portal" });
  });

  it("surfaces detailed and fallback Stripe errors plus subscription failures", async () => {
    const rejectedJson = { ok: false, status: 500, json: vi.fn().mockRejectedValue(new Error("invalid json")) };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ error: "checkout detail" }, { ok: false, status: 400 }))
      .mockResolvedValueOnce(rejectedJson)
      .mockResolvedValueOnce(jsonResponse({ error: "portal detail" }, { ok: false, status: 400 }))
      .mockResolvedValueOnce(rejectedJson);
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSubscriptionStatus()).rejects.toThrow("Failed to fetch subscription status");
    await expect(createStripeCheckoutSession()).rejects.toThrow("checkout detail");
    await expect(createStripeCheckoutSession()).rejects.toThrow("Failed to create checkout session");
    await expect(createStripePortalSession()).rejects.toThrow("portal detail");
    await expect(createStripePortalSession()).rejects.toThrow("Failed to create portal session");
  });
});
