import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type * as MockBeeApi from "@/lib/mockBeeApi";

let api: typeof MockBeeApi;

const request = {
  level: "1" as const,
  wordSource: "standard" as const,
  wordCount: 10 as const,
  childProfile: { childId: "child", age: 8, grade: "2", spellingLevel: "level_1" },
};

describe("mock bee in-memory fallback", () => {
  beforeAll(async () => {
    vi.stubEnv("VITE_MOCK_BEE_FALLBACK", "1");
    vi.resetModules();
    api = await import("@/lib/mockBeeApi");
    vi.useFakeTimers().setSystemTime(new Date("2026-07-17T00:00:00Z"));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:silent") });
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("creates, restores, advances, completes, and reviews a session without network calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const session = await api.createMockBeeRound(request);
    expect(session.id).toMatch(/^mock_/);
    expect(session.currentChallenge).toMatchObject({ turnIndex: 0, turnNumber: 1 });
    expect(session.currentChallenge?.supports.exampleSentence).toContain("___");
    await expect(api.getMockBeeSession(session.id)).resolves.toBe(session);

    const correct = await api.submitMockBeeAttempt(session.id, {
      childAttempt: "  FRIEND ",
      supportsUsed: { definitionViewed: true, exampleViewed: false, originViewed: false },
    });
    expect(correct.result).toMatchObject({ isCorrect: true, timedOut: false, revealAnswer: true, correctWord: "friend" });

    for (let i = 1; i < 10; i += 1) {
      await api.timeoutMockBee(session.id);
    }
    expect(session.status).toBe("completed");
    expect(session.progress).toMatchObject({ answeredCount: 10, correctCount: 1, incorrectCount: 9, timedOutCount: 9 });
    expect(session.currentChallenge).toBeNull();

    const pending = await api.fetchMockBeeReview(session.id);
    expect(pending.reviewStatus).toEqual({ not_started: 0, pending: 10, completed: 0, failed: 0 });
    expect(pending.words[0]).toMatchObject({ status: "submitted", isCorrect: true, reviewCardStatus: "pending" });
    expect(pending.words[1]).toMatchObject({ status: "timed_out", childAttempt: null, isCorrect: false });

    vi.advanceTimersByTime(1500);
    const complete = await api.fetchMockBeeReview(session.id);
    expect(complete.reviewStatus).toEqual({ not_started: 0, pending: 0, completed: 10, failed: 0 });
    expect(complete.words.every((word) => word.reviewCard !== null)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the level-three no-reveal policy", async () => {
    const session = await api.createMockBeeRound({ ...request, level: "3" });
    const response = await api.submitMockBeeAttempt(session.id, {
      childAttempt: "wrong",
      supportsUsed: { definitionViewed: false, exampleViewed: false, originViewed: false },
    });
    expect(response.result).toMatchObject({ isCorrect: false, revealAnswer: false });
    expect(response.result.correctWord).toBeUndefined();
  });

  it("returns silent pronunciation audio for an active challenge", async () => {
    const session = await api.createMockBeeRound(request);
    await expect(api.fetchMockBeeCurrentWordAudio(session.id)).resolves.toBe("blob:silent");
  });

  it.each([
    ["session", () => api.getMockBeeSession("unknown"), "Unknown session"],
    ["submit", () => api.submitMockBeeAttempt("unknown", { childAttempt: "x", supportsUsed: { definitionViewed: false, exampleViewed: false, originViewed: false } }), "Unknown session"],
    ["timeout", () => api.timeoutMockBee("unknown"), "Unknown session"],
    ["audio", () => api.fetchMockBeeCurrentWordAudio("unknown"), "No current word"],
    ["review", () => api.fetchMockBeeReview("unknown"), "Unknown session"],
  ])("rejects unknown %s lookups", async (_name, action, message) => {
    await expect(action()).rejects.toThrow(message);
  });
});
