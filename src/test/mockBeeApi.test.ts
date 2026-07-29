import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken } = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  getAccessToken,
  supabaseConfigured: false,
  supabase: { auth: { getSession: vi.fn(), signOut: vi.fn() } },
}));

import {
  createMockBeeRound,
  fetchMockBeeCurrentWordAudio,
  fetchMockBeeReview,
  getMockBeeSession,
  submitMockBeeAttempt,
  timeoutMockBee,
  TIMER_BY_LEVEL,
} from "@/lib/mockBeeApi";
import { UnauthorizedError } from "@/lib/api";

const request = {
  level: "2" as const,
  wordSource: "standard" as const,
  wordCount: 10 as const,
  childProfile: { childId: "child", age: 10, grade: "5", spellingLevel: "level_2" },
};

describe("mock bee API client", () => {
  beforeEach(() => {
    getAccessToken.mockReset().mockResolvedValue("token-1");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("defines timer boundaries for all levels", () => {
    expect(TIMER_BY_LEVEL["1"]).toMatchObject({ secondsPerWord: 60, showCountdown: false, revealAnswerOnSubmit: true });
    expect(TIMER_BY_LEVEL["2"]).toMatchObject({ secondsPerWord: 45, showCountdown: true, revealAnswerOnSubmit: true });
    expect(TIMER_BY_LEVEL["3"]).toMatchObject({ secondsPerWord: 30, showCountdown: true, revealAnswerOnSubmit: false });
  });

  it("creates a round with auth and returns the session", async () => {
    const session = { id: "bee-1" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ session }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(createMockBeeRound(request)).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/mock-bee\/sessions$/), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify(request),
    });
  });

  it("omits authorization without a token and encodes session IDs", async () => {
    getAccessToken.mockResolvedValue(null);
    const session = { id: "a/b c" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ session }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getMockBeeSession("a/b c")).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/a%2Fb%20c"), { headers: {} });
  });

  it("submits attempts and registers timeouts", async () => {
    const submitResponse = { session: { id: "bee" }, result: { isCorrect: true } };
    const timeoutResponse = { session: { id: "bee" }, result: { timedOut: true } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => submitResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => timeoutResponse });
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      childAttempt: "rhythm",
      supportsUsed: { definitionViewed: true, exampleViewed: false, originViewed: false },
    };
    await expect(submitMockBeeAttempt("bee", body)).resolves.toEqual(submitResponse);
    await expect(timeoutMockBee("bee")).resolves.toEqual(timeoutResponse);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(body) });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", body: "{}" });
  });

  it("turns pronunciation blobs into object URLs and unwraps reviews", async () => {
    const audio = new Blob(["wav"], { type: "audio/wav" });
    const review = { id: "bee", status: "completed" };
    const createObjectURL = vi.fn(() => "blob:bee-audio");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, blob: async () => audio })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ review }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchMockBeeCurrentWordAudio("bee")).resolves.toBe("blob:bee-audio");
    await expect(fetchMockBeeReview("bee")).resolves.toEqual(review);
    expect(createObjectURL).toHaveBeenCalledWith(audio);
  });

  it("maps unauthorized create responses to UnauthorizedError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(createMockBeeRound(request)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each([
    ["create", () => createMockBeeRound(request), "Failed to create mock bee round"],
    ["get", () => getMockBeeSession("missing"), "Failed to fetch mock bee session"],
    ["submit", () => submitMockBeeAttempt("missing", { childAttempt: "", supportsUsed: { definitionViewed: false, exampleViewed: false, originViewed: false } }), "Failed to submit attempt"],
    ["timeout", () => timeoutMockBee("missing"), "Failed to register timeout"],
    ["audio", () => fetchMockBeeCurrentWordAudio("missing"), "Failed to fetch pronunciation"],
    ["review", () => fetchMockBeeReview("missing"), "Failed to fetch review"],
  ])("rejects failed %s responses", async (_name, action, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(action()).rejects.toThrow(message);
  });
});
