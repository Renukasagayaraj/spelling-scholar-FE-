import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchForeignOrigins,
  invalidateForeignOriginsCache,
  fetchCustomLists,
  invalidateCustomListsCache,
  endPracticeSession,
  fetchNextWord,
  fetchSessionAttempts,
  startPracticeSession,
  submitAndRecordSpellingAttempt,
  submitSpellingAttempt,
  importCustomWordFile,
  type CoachingRequest,
} from "@/lib/api";

describe("file import API", () => {
  beforeEach(() => {
    invalidateCustomListsCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads multipart data and polls an asynchronous import to completion", async () => {
    const result = {
      list: { id: "list-1", name: "words", level: "custom", wordCount: 2 },
      importedCount: 2,
      skippedExistingCount: 1,
      words: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "job-1" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "processing" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "done", result }) });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["friend\nfriend\nschool"], "words.txt", { type: "text/plain" });
    await expect(importCustomWordFile(file, { pollIntervalMs: 0 })).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const uploadOptions = fetchMock.mock.calls[0][1];
    expect(uploadOptions.method).toBe("POST");
    expect(uploadOptions.body).toBeInstanceOf(FormData);
    expect(uploadOptions.headers).not.toHaveProperty("Content-Type");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/words/import-jobs/job-1");
  });

  it("surfaces the backend validation message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 415,
      json: async () => ({ error: "Only .txt and .csv files are accepted." }),
    }));

    const file = new File(["data"], "words.pdf", { type: "application/pdf" });
    await expect(importCustomWordFile(file)).rejects.toThrow("Only .txt and .csv files are accepted.");
  });

  it("surfaces a failed import job terminal state", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "job-fail" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "failed", error: "No words could be extracted." }) }),
    );

    const file = new File(["   \n\n"], "empty.txt", { type: "text/plain" });
    await expect(importCustomWordFile(file, { pollIntervalMs: 0 })).rejects.toThrow("No words could be extracted.");
  });

  it("rejects with a timeout message when maxPolls is exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "job-slow" }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "processing" }) }),
    );

    const file = new File(["friend"], "words.txt", { type: "text/plain" });
    await expect(importCustomWordFile(file, { pollIntervalMs: 0, maxPolls: 2 })).rejects.toThrow(
      "taking longer than expected",
    );
  });

  it("surfaces an upload network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const file = new File(["friend"], "words.txt", { type: "text/plain" });
    await expect(importCustomWordFile(file, { pollIntervalMs: 0 })).rejects.toThrow("Failed to fetch");
  });

  it("surfaces a poll network failure", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "job-net" }) })
      .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );

    const file = new File(["friend"], "words.txt", { type: "text/plain" });
    await expect(importCustomWordFile(file, { pollIntervalMs: 0 })).rejects.toThrow("Failed to fetch");
  });

  it("aborts the upload fetch when the signal is triggered before fetch resolves", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const file = new File(["friend"], "words.txt", { type: "text/plain" });
    controller.abort();
    await expect(importCustomWordFile(file, { pollIntervalMs: 0, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("aborts the poll loop when the signal fires between polls", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ jobId: "job-abort" }) })
      .mockImplementation(() => {
        controller.abort();
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: "processing" }) });
      }),
    );

    const file = new File(["friend"], "words.txt", { type: "text/plain" });
    await expect(importCustomWordFile(file, { pollIntervalMs: 0, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

describe("API caching layer", () => {
  beforeEach(() => {
    invalidateForeignOriginsCache();
    invalidateCustomListsCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchForeignOrigins deduplicates and caches parallel and sequential calls", async () => {
    const mockOrigins = { origins: [{ origin: "French", wordCount: 5 }] };
    
    // Setup fetch mock to return status 200 ok with json response
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOrigins,
    });
    vi.stubGlobal("fetch", fetchMock);

    // Make parallel calls
    const [res1, res2] = await Promise.all([
      fetchForeignOrigins(),
      fetchForeignOrigins(),
    ]);

    // Make a sequential call
    const res3 = await fetchForeignOrigins();

    expect(res1).toEqual(mockOrigins);
    expect(res2).toEqual(mockOrigins);
    expect(res3).toEqual(mockOrigins);
    
    // Check that fetch was only called exactly once
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/foreign-origins"));
  });

  it("invalidateForeignOriginsCache clears the cache, forcing a new network call", async () => {
    const mockOrigins1 = { origins: [{ origin: "French", wordCount: 5 }] };
    const mockOrigins2 = { origins: [{ origin: "Latin", wordCount: 10 }] };
    
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrigins1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrigins2,
      });
    vi.stubGlobal("fetch", fetchMock);

    // First fetch
    const firstRes = await fetchForeignOrigins();
    expect(firstRes).toEqual(mockOrigins1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Invalidate
    invalidateForeignOriginsCache();

    // Second fetch (should trigger a new fetch)
    const secondRes = await fetchForeignOrigins();
    expect(secondRes).toEqual(mockOrigins2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears foreignOriginsCache on request failure so subsequent calls can retry", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false, // Fails first time
      })
      .mockResolvedValueOnce({
        ok: true, // Succeeds second time
        json: async () => ({ origins: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    // First attempt should fail
    await expect(fetchForeignOrigins()).rejects.toThrow("Failed to fetch foreign origins");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second attempt should retry and succeed
    const successRes = await fetchForeignOrigins();
    expect(successRes).toEqual({ origins: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetchCustomLists deduplicates and caches requests", async () => {
    const mockLists = { lists: [{ id: "1", name: "Spelling List", level: "Grade 3", wordCount: 12 }] };
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLists,
    });
    vi.stubGlobal("fetch", fetchMock);

    const [res1, res2] = await Promise.all([
      fetchCustomLists(),
      fetchCustomLists(),
    ]);

    expect(res1).toEqual(mockLists);
    expect(res2).toEqual(mockLists);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/custom-lists"),
      expect.any(Object)
    );
  });

  it("invalidateCustomListsCache clears custom list cache", async () => {
    const mockLists1 = { lists: [{ id: "1", name: "List 1", level: "Grade 3", wordCount: 12 }] };
    const mockLists2 = { lists: [{ id: "2", name: "List 2", level: "Grade 4", wordCount: 15 }] };
    
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLists1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLists2,
      });
    vi.stubGlobal("fetch", fetchMock);

    await fetchCustomLists();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    invalidateCustomListsCache();

    await fetchCustomLists();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function streamingResponse(chunks: string[]) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    ok: true,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "text/event-stream" : null,
    },
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { value: encoder.encode(chunks[index++]), done: false }
            : { value: undefined, done: true },
        cancel: vi.fn().mockResolvedValue(undefined),
        releaseLock: vi.fn(),
      }),
    },
  };
}

const streamingRequest: CoachingRequest = {
  targetWord: "abundance",
  childAttempt: "abundence",
  level: 2,
  mode: "standard",
  definitionViewed: true,
  exampleViewed: false,
  originViewed: false,
  partOfSpeechViewed: true,
  repeatWordCount: 0,
  usedVoiceInput: false,
};

describe("spelling coach streaming API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the streaming endpoint and publishes each SSE stage immediately", async () => {
    const rawEvents = [
      `event: meta\r\ndata: ${JSON.stringify({ requestId: "req-1", isCorrect: false, timingMs: 2, targetWordMasked: true, missAnalysis: { summary: "", errorTypes: ["letter substitution"], primaryErrorFocus: "Substitution: e for a", likelyWrongWordInterpretation: false, usedMeaningDisambiguationWell: false } })}\r\n\r\n`,
      `event: precomputed\ndata: ${JSON.stringify({ payload: { wordTeaching: { conceptTeaching: { summary: "Word teaching", meaningFocus: "", originFocus: "", morphologyFocus: "", originLabels: [], morphologyLabels: [], relatedForms: [] } }, wordBreakdown: { displayChunks: ["abun", "dance"], chunkReason: "chunks", matchedPatterns: [] }, conceptLabels: { originLabels: [], patternLabels: [], morphologyLabels: [] } }, timingMs: 3 })}\n\n`,
      `event: section-start\ndata: ${JSON.stringify({ section: "miss_analysis", timingMs: 4 })}\n\n`,
      `event: section-chunk\ndata: ${JSON.stringify({ section: "miss_analysis", text: "Vowel ", timingMs: 5 })}\n\n`,
      `event: section-chunk\ndata: ${JSON.stringify({ section: "miss_analysis", text: "substitution", timingMs: 6 })}\n\n`,
      `event: section-complete\ndata: ${JSON.stringify({ section: "miss_analysis", timingMs: 7 })}\n\n`,
      `event: section-start\ndata: ${JSON.stringify({ section: "explanation", timingMs: 8 })}\n\n`,
      `event: section-chunk\ndata: ${JSON.stringify({ section: "explanation", text: "Use ", timingMs: 9 })}\n\n`,
      `event: section-chunk\ndata: ${JSON.stringify({ section: "explanation", text: "an a.", timingMs: 10 })}\n\n`,
      `event: section-complete\ndata: ${JSON.stringify({ section: "explanation", timingMs: 11 })}\n\n`,
      `event: section-start\ndata: ${JSON.stringify({ section: "memory_tip", timingMs: 12 })}\n\n`,
      `event: section-chunk\ndata: ${JSON.stringify({ section: "memory_tip", text: "Remember dance.", timingMs: 13 })}\n\n`,
      `event: section-complete\ndata: ${JSON.stringify({ section: "memory_tip", timingMs: 14 })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ complete: true, timings: { metaMs: 2, precomputedMs: 3, runtimeCoachingMs: 6, totalMs: 11 } })}\n\n`,
    ].join("");
    const chunks = rawEvents.match(/[\s\S]{1,37}/g) ?? [];
    const fetchMock = vi.fn().mockResolvedValue(streamingResponse(chunks));
    vi.stubGlobal("fetch", fetchMock);
    const stages: string[] = [];

    const result = await submitSpellingAttempt(streamingRequest, {
      onMeta: (_meta, partial) => {
        stages.push("meta");
        expect(partial.correctness.isCorrect).toBe(false);
        expect(partial.wordBreakdown.displayChunks).toEqual([]);
        expect(partial.missAnalysis.errorTypes).toEqual(["letter substitution"]);
      },
      onPrecomputed: (partial) => {
        stages.push("precomputed");
        expect(partial.wordBreakdown.displayChunks).toEqual(["abun", "dance"]);
        expect(partial.missAnalysis.summary).toBe("");
      },
      onSectionStart: ({ section }, partial) => {
        stages.push(`${section}:start`);
        expect(partial.streamSections?.[section].status).toBe("streaming");
      },
      onSectionChunk: ({ section }, partial) => {
        stages.push(`${section}:chunk`);
        if (section === "miss_analysis") {
          expect(["Vowel ", "Vowel substitution"]).toContain(partial.missAnalysis.summary);
        }
        if (section === "explanation") {
          expect(["Use ", "Use an a."]).toContain(partial.coachingText.fullExplanation);
        }
      },
      onSectionComplete: ({ section }, partial) => {
        stages.push(`${section}:complete`);
        expect(partial.streamSections?.[section].status).toBe("complete");
      },
      onDone: () => stages.push("done"),
    });

    expect(stages).toEqual([
      "meta",
      "precomputed",
      "miss_analysis:start",
      "miss_analysis:chunk",
      "miss_analysis:chunk",
      "miss_analysis:complete",
      "explanation:start",
      "explanation:chunk",
      "explanation:chunk",
      "explanation:complete",
      "memory_tip:start",
      "memory_tip:chunk",
      "memory_tip:complete",
      "done",
    ]);
    expect(result.missAnalysis.summary).toBe("Vowel substitution");
    expect(result.missAnalysis.errorTypes).toEqual(["letter substitution"]);
    expect(result.coachingText.fullExplanation).toBe("Use an a.");
    expect(result.coachingText.memoryTip).toBe("Remember dance.");
    expect(result.streamSections?.memory_tip.text).toBe("Remember dance.");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/spelling-coach/stream"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(streamingRequest),
      }),
    );
    expect(fetchMock.mock.calls[0][0]).not.toMatch(/\/api\/spelling-coach$/);
  });

  it("keeps partial coaching usable after a section-error and finishes on done", async () => {
    const stream = [
      `event: meta\ndata: ${JSON.stringify({ requestId: "req-2", isCorrect: false, timingMs: 1, targetWordMasked: true })}\n\n`,
      `event: precomputed\ndata: ${JSON.stringify({ payload: { wordBreakdown: { displayChunks: ["abun", "dance"], chunkReason: "chunks", matchedPatterns: [] } }, timingMs: 2 })}\n\n`,
      `event: section-error\ndata: ${JSON.stringify({ section: "explanation", error: { code: "SECTION_TIMEOUT", message: "Timed out." }, timingMs: 10 })}\n\n`,
      `event: section\ndata: ${JSON.stringify({ section: "memory_tip", payload: { memoryTip: "Remember dance." }, timingMs: 11 })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ complete: true, timings: { metaMs: 1, precomputedMs: 2, runtimeCoachingMs: 11, totalMs: 14 } })}\n\n`,
    ].join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse([stream])));
    const errors: string[] = [];
    let completed = false;

    const result = await submitSpellingAttempt(streamingRequest, {
      onSectionError: ({ section }) => errors.push(section),
      onDone: () => {
        completed = true;
      },
    });

    expect(errors).toEqual(["explanation"]);
    expect(completed).toBe(true);
    expect(result.wordBreakdown.displayChunks).toEqual(["abun", "dance"]);
    expect(result.coachingText.fullExplanation).toBe("");
    expect(result.coachingText.memoryTip).toBe("Remember dance.");
    expect(result.streamSections?.explanation.status).toBe("error");
    expect(result.streamSections?.explanation.error?.code).toBe("SECTION_TIMEOUT");
    expect(result.streamSections?.memory_tip.status).toBe("complete");
  });

  it("surfaces an aborted streaming request", async () => {
    const abortError = Object.assign(new Error("cancelled"), {
      name: "AbortError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(
      submitSpellingAttempt(streamingRequest, {
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("surfaces a network failure without generating synthetic coaching", async () => {
    const networkError = new TypeError("Failed to fetch");
    const onMeta = vi.fn();
    const onPrecomputed = vi.fn();
    const onSection = vi.fn();
    const onDone = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));

    await expect(
      submitSpellingAttempt(streamingRequest, {
        onMeta,
        onPrecomputed,
        onSection,
        onDone,
      }),
    ).rejects.toBe(networkError);

    expect(onMeta).not.toHaveBeenCalled();
    expect(onPrecomputed).not.toHaveBeenCalled();
    expect(onSection).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("surfaces a pre-stream HTTP 500 without using mock coaching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => "application/json" },
        json: async () => ({ error: "Streaming request failed." }),
      }),
    );

    await expect(submitSpellingAttempt(streamingRequest)).rejects.toThrow(
      "Streaming request failed.",
    );
  });

  it("treats done as terminal even if the server leaves the stream open", async () => {
    const encoder = new TextEncoder();
    let reads = 0;
    let cancelled = false;
    const terminalStream = [
      `event: meta\ndata: ${JSON.stringify({ requestId: "req-terminal", isCorrect: true, timingMs: 1, targetWordMasked: true })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ complete: true, timings: { metaMs: 1, precomputedMs: 0, runtimeCoachingMs: 0, totalMs: 1 } })}\n\n`,
    ].join("");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: {
          getReader: () => ({
            read: async () => {
              reads += 1;
              if (reads === 1) {
                return { value: encoder.encode(terminalStream), done: false };
              }
              return new Promise(() => {});
            },
            cancel: async () => {
              cancelled = true;
            },
            releaseLock: vi.fn(),
          }),
        },
      }),
    );

    const result = await submitSpellingAttempt({
      ...streamingRequest,
      childAttempt: streamingRequest.targetWord,
    });

    expect(result.correctness.isCorrect).toBe(true);
    expect(cancelled).toBe(true);
    expect(reads).toBe(1);
  });
});

describe("streaming practice session lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts, restores attempts, streams, persists once after done, refreshes, and ends", async () => {
    const session = {
      id: "session-1",
      user_id: "user-1",
      mode: "standard_level_2",
      status: "active" as const,
      session_started_at: "2026-07-16T10:00:00.000Z",
      session_ended_at: null,
      total_words_attempted: 1,
      total_correct: 0,
      created_at: "2026-07-16T10:00:00.000Z",
    };
    const stream = [
      `event: meta\ndata: ${JSON.stringify({ requestId: "req-lifecycle", isCorrect: false, timingMs: 1, targetWordMasked: true })}\n\n`,
      `event: precomputed\ndata: ${JSON.stringify({ payload: { wordTeaching: { conceptTeaching: { summary: "Teaching", meaningFocus: "", originFocus: "", morphologyFocus: "", originLabels: [], morphologyLabels: [] } }, wordBreakdown: { displayChunks: ["abun", "dance"], chunkReason: "chunks", matchedPatterns: [] }, conceptLabels: { originLabels: [], patternLabels: [], morphologyLabels: [] } }, timingMs: 2 })}\n\n`,
      `event: section\ndata: ${JSON.stringify({ section: "miss_analysis", payload: { missAnalysis: { summary: "Vowel substitution", errorTypes: ["substitution"], primaryErrorFocus: "a", likelyWrongWordInterpretation: false, usedMeaningDisambiguationWell: false }, errorRelevance: { mostRelevantToError: "form", confidence: 1, reason: "form" }, teachingDecision: { strategy: "pattern", primaryFocus: "a", secondaryFocuses: [], confidence: 1, rationale: "pattern" } }, timingMs: 3 })}\n\n`,
      `event: section\ndata: ${JSON.stringify({ section: "explanation", payload: { shortFeedback: "Close!", fullExplanation: "Use an a.", sayAloudTip: "Say it slowly." }, timingMs: 4 })}\n\n`,
      `event: section\ndata: ${JSON.stringify({ section: "memory_tip", payload: { memoryTip: "Remember dance." }, timingMs: 5 })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ complete: true, timings: { metaMs: 1, precomputedMs: 2, runtimeCoachingMs: 5, totalMs: 8 } })}\n\n`,
    ].join("");
    const nextWord = {
      word: "abundance",
      level: "2",
      gradeBand: "4-6",
      difficulty: "medium",
      origin: "Latin",
      definition: "A large amount.",
      exampleSentence: "There was an abundance of flowers.",
      partOfSpeech: "noun",
      pronunciation: "uh-BUN-duns",
      patterns: [],
    };
    const onDone = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ action: "created", sessionId: "session-1" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ attempts: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => nextWord })
      .mockResolvedValueOnce(streamingResponse([stream]))
      .mockImplementationOnce(async () => {
        expect(onDone).toHaveBeenCalledTimes(1);
        return { ok: true, status: 200, json: async () => ({ attemptId: "attempt-1" }) };
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ session }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const started = await startPracticeSession({ mode: "standard", level: 2 });
    expect(started).toEqual({ action: "created", sessionId: "session-1" });
    expect(await fetchSessionAttempts("session-1")).toEqual([]);
    expect(await fetchNextWord({ level: 2 })).toEqual(nextWord);

    const completed = await submitAndRecordSpellingAttempt(
      { ...streamingRequest, sessionId: "session-1" },
      {
        sessionId: "session-1",
        targetWord: "abundance",
        childAttempt: "abundence",
        level: 2,
        mode: "standard_level_2",
        definitionViewed: true,
        exampleViewed: false,
        originViewed: false,
        partOfSpeechViewed: true,
        repeatWordCount: 0,
        usedVoiceInput: false,
      },
      { onDone },
    );
    const persisted = await completed.persistence;
    expect(persisted.attemptId).toBe("attempt-1");
    expect(persisted.session).toEqual(session);

    await endPracticeSession({
      sessionId: "session-1",
      totalWordsAttempted: 1,
      totalCorrect: 0,
      durationSeconds: 20,
    });

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://localhost").pathname + new URL(String(url), "http://localhost").search)).toEqual([
      "/api/sessions/start",
      "/api/sessions/attempts?sessionId=session-1",
      "/api/words/next?level=2",
      "/api/spelling-coach/stream",
      "/api/sessions/attempts",
      "/api/sessions/current?sessionId=session-1",
      "/api/sessions/end",
    ]);
    const persistenceBody = JSON.parse(fetchMock.mock.calls[4][1].body as string);
    const { coachingResponse, ...persistedAttempt } = persistenceBody;
    expect(persistedAttempt).toEqual({
      sessionId: "session-1",
      targetWord: "abundance",
      childAttempt: "abundence",
      isCorrect: false,
      level: 2,
      mode: "standard_level_2",
      definitionViewed: true,
      exampleViewed: false,
      originViewed: false,
      partOfSpeechViewed: true,
      repeatWordCount: 0,
      usedVoiceInput: false,
    });
    const storedCoaching = JSON.parse(coachingResponse);
    expect(storedCoaching.missAnalysis.summary).toBe("Vowel substitution");
    expect(storedCoaching.coachingText.fullExplanation).toBe("Use an a.");
    expect(storedCoaching.coachingText.memoryTip).toBe("Remember dance.");
    expect(storedCoaching.wordBreakdown.displayChunks).toEqual(["abun", "dance"]);
    expect(storedCoaching.streamMetadata.meta.requestId).toBe("req-lifecycle");
    expect(storedCoaching.streamMetadata.done.timings.totalMs).toBe(8);
    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) =>
          new URL(String(url), "http://localhost").pathname === "/api/sessions/attempts" &&
          options?.method === "POST",
      ),
    ).toHaveLength(1);
  });

  it("does not persist an attempt when the stream ends before done", async () => {
    const incomplete = [
      `event: meta\ndata: ${JSON.stringify({ requestId: "req-incomplete", isCorrect: false, timingMs: 1, targetWordMasked: true })}\n\n`,
      `event: precomputed\ndata: ${JSON.stringify({ payload: {}, timingMs: 2 })}\n\n`,
    ].join("");
    const fetchMock = vi.fn().mockResolvedValue(streamingResponse([incomplete]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitAndRecordSpellingAttempt(
        { ...streamingRequest, sessionId: "session-1" },
        {
          sessionId: "session-1",
          targetWord: "abundance",
          childAttempt: "abundence",
          level: 2,
          mode: "standard_level_2",
          definitionViewed: true,
          exampleViewed: false,
          originViewed: false,
          partOfSpeechViewed: true,
          repeatWordCount: 0,
          usedVoiceInput: false,
        },
      ),
    ).rejects.toThrow("Spelling coach stream ended before done.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns completed coaching at done while persistence continues in order", async () => {
    const doneStream = [
      `event: meta\ndata: ${JSON.stringify({ requestId: "req-background", isCorrect: true, timingMs: 1, targetWordMasked: true })}\n\n`,
      `event: precomputed\ndata: ${JSON.stringify({ payload: {}, timingMs: 2 })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ complete: true, timings: { metaMs: 1, precomputedMs: 2, runtimeCoachingMs: 0, totalMs: 3 } })}\n\n`,
    ].join("");
    let releasePrevious!: () => void;
    const previousPersistence = new Promise<void>((resolve) => {
      releasePrevious = resolve;
    });
    const onAttemptSaved = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(streamingResponse([doneStream]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ attemptId: "attempt-background" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ session: null }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const completed = await submitAndRecordSpellingAttempt(
      { ...streamingRequest, childAttempt: streamingRequest.targetWord, sessionId: "session-1" },
      {
        sessionId: "session-1",
        targetWord: "abundance",
        childAttempt: "abundance",
        level: 2,
        mode: "standard_level_2",
        definitionViewed: true,
        exampleViewed: false,
        originViewed: false,
        partOfSpeechViewed: true,
        repeatWordCount: 0,
        usedVoiceInput: false,
      },
      {},
      { waitForPreviousPersistence: previousPersistence, onAttemptSaved },
    );

    expect(completed.coaching.correctness.isCorrect).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releasePrevious();
    const persisted = await completed.persistence;
    expect(persisted.attemptId).toBe("attempt-background");
    expect(onAttemptSaved).toHaveBeenCalledWith("attempt-background");
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url), "http://localhost").pathname)).toEqual([
      "/api/spelling-coach/stream",
      "/api/sessions/attempts",
      "/api/sessions/current",
    ]);
  });

  it("surfaces a persistence failure without replaying the stream or duplicating the write", async () => {
    const doneStream = [
      `event: meta\ndata: ${JSON.stringify({ requestId: "req-retry", isCorrect: true, timingMs: 1, targetWordMasked: true })}\n\n`,
      `event: precomputed\ndata: ${JSON.stringify({ payload: {}, timingMs: 2 })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ complete: true, timings: { metaMs: 1, precomputedMs: 2, runtimeCoachingMs: 0, totalMs: 3 } })}\n\n`,
    ].join("");
    const onAttemptSaved = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(streamingResponse([doneStream]))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const completed = await submitAndRecordSpellingAttempt(
      { ...streamingRequest, childAttempt: streamingRequest.targetWord, sessionId: "session-1" },
      {
        sessionId: "session-1",
        targetWord: "abundance",
        childAttempt: "abundance",
        level: 2,
        mode: "standard_level_2",
        definitionViewed: true,
        exampleViewed: false,
        originViewed: false,
        partOfSpeechViewed: true,
        repeatWordCount: 0,
        usedVoiceInput: false,
      },
      {},
      { onAttemptSaved },
    );

    await expect(completed.persistence).rejects.toThrow("Failed to fetch");
    expect(onAttemptSaved).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => new URL(String(url), "http://localhost").pathname === "/api/sessions/attempts",
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => new URL(String(url), "http://localhost").pathname === "/api/spelling-coach/stream",
      ),
    ).toHaveLength(1);
  });
});
