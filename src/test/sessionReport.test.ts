import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSessionReportPdf, downloadSessionReport } from "@/lib/sessionReport";
import type { HistoryEntry } from "@/components/SessionHistoryPanel";
import { mockCoaching } from "@/lib/mocks";

function entry(correct: boolean, index = 0): HistoryEntry {
  const word = {
    word: correct ? "necessary" : `rhythm${index}`,
    level: "2",
    gradeBand: "3-5",
    difficulty: "medium",
    origin: "Greek (root) \\ history — extended origin text that wraps across the report width",
    definition: "A regular repeated pattern of sound or movement with enough detail to wrap onto another line in a PDF report.",
    exampleSentence: "The drummer kept a steady rhythm during the long performance.",
    partOfSpeech: "noun",
    pronunciation: "RITH-uhm",
    patterns: [],
  };
  const result = mockCoaching({
    targetWord: word.word,
    childAttempt: correct ? word.word : "rythm",
    level: 2,
    mode: "standard",
    definitionViewed: true,
    exampleViewed: true,
    originViewed: true,
    partOfSpeechViewed: true,
    repeatWordCount: 0,
    usedVoiceInput: false,
  });
  return { word, attempt: correct ? word.word : "rythm", result };
}

describe("session PDF reports", () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-07-17T00:00:00Z")));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a PDF for empty, correct, and incorrect histories", () => {
    const empty = buildSessionReportPdf([]);
    const populated = buildSessionReportPdf([entry(true), entry(false)]);
    expect(empty.type).toBe("application/pdf");
    expect(empty.size).toBeGreaterThan(100);
    expect(populated.type).toBe("application/pdf");
    expect(populated.size).toBeGreaterThan(empty.size);
  });

  it("paginates a long report", () => {
    const short = buildSessionReportPdf([entry(false)]);
    const long = buildSessionReportPdf(Array.from({ length: 30 }, (_, i) => entry(i % 2 === 0, i)));
    expect(long.size).toBeGreaterThan(short.size * 10);
  });

  it("downloads and later revokes the generated object URL", () => {
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadSessionReport([entry(false)]);

    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "application/pdf" }));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a")).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });
});
