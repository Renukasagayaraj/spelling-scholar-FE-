import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockCoaching, mockNextWord, mockPronunciationAudio } from "@/lib/mocks";

describe("local preview mocks", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock") });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("cycles level words and falls back to level two for invalid or missing levels", () => {
    const first = mockNextWord({ level: 1 });
    const second = mockNextWord({ level: 1 });
    const cycled = mockNextWord({ level: 1 });
    const fallback = mockNextWord({ level: 999 });
    const missing = mockNextWord({});
    expect([first.word, second.word]).toEqual(expect.arrayContaining(["friend", "because"]));
    expect(cycled.word).toBe(first.word);
    expect(["rhythm", "necessary"]).toContain(fallback.word);
    expect(["rhythm", "necessary"]).toContain(missing.word);
  });

  it("overrides the origin in foreign-origin mode without mutating the catalog", () => {
    const foreign = mockNextWord({ level: 3, foreignOrigin: "Japanese" });
    const normal = mockNextWord({ level: 3 });
    expect(foreign.origin).toBe("Japanese origin (mock).");
    expect(normal.origin).not.toBe("Japanese origin (mock).");
  });

  it("builds complete positive and negative coaching", () => {
    const correct = mockCoaching({
      targetWord: "Cat",
      childAttempt: "CAT",
      level: 1,
      mode: "standard",
      definitionViewed: false,
      exampleViewed: false,
      originViewed: false,
      partOfSpeechViewed: false,
      repeatWordCount: 0,
      usedVoiceInput: false,
    });
    const incorrect = mockCoaching({
      targetWord: "rhythm",
      childAttempt: "rythm",
      level: 2,
      mode: "standard",
      definitionViewed: true,
      exampleViewed: true,
      originViewed: true,
      partOfSpeechViewed: true,
      repeatWordCount: 1,
      usedVoiceInput: true,
    });

    expect(correct.correctness).toEqual({ isCorrect: true, reinforceSuccess: true });
    expect(correct.missAnalysis.primaryErrorType).toBeNull();
    expect(correct.missAnalysis.secondaryErrorTypes).toEqual([]);
    expect(correct.wordBreakdown.displayChunks).toEqual(["cat"]);
    expect(correct.wordBreakdown.matchedPatterns[0].matchedText).toBe("ca");
    expect(correct.nextStep.shouldReviewSoon).toBe(false);
    expect(incorrect.correctness.isCorrect).toBe(false);
    expect(incorrect.missAnalysis.primaryErrorType).toBe("vowel_confusion");
    expect(incorrect.missAnalysis.secondaryErrorTypes).toEqual(["missing_letter"]);
    expect(incorrect.wordBreakdown.displayChunks).toEqual(["rhy", "thm"]);
    expect(incorrect.nextStep.shouldReviewSoon).toBe(true);
  });

  it("handles a one-character target in the matched pattern", () => {
    const result = mockCoaching({
      targetWord: "I", childAttempt: "a", level: 1, mode: "standard",
      definitionViewed: false, exampleViewed: false, originViewed: false,
      partOfSpeechViewed: false, repeatWordCount: 0, usedVoiceInput: false,
    });
    expect(result.wordBreakdown.matchedPatterns[0].matchedText).toBe("i");
  });

  it("speaks when available and always returns a local audio URL", () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel, speak } });
    vi.stubGlobal("SpeechSynthesisUtterance", vi.fn(function (this: { rate: number }) { this.rate = 1; }));
    expect(mockPronunciationAudio("friend")).toBe("blob:mock");
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
  });

  it("falls back to silent audio if speech synthesis throws", () => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: () => { throw new Error("unsupported"); } },
    });
    expect(mockPronunciationAudio("friend")).toBe("blob:mock");
  });
});
