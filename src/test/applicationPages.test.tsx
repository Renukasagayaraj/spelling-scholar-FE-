import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  subscribed: false,
  fetchNextWord: vi.fn(),
  fetchForeignOrigins: vi.fn(),
  fetchCustomLists: vi.fn(),
  fetchCustomListWords: vi.fn(),
  fetchForeignOriginDetails: vi.fn(),
  fetchPronunciationAudio: vi.fn(),
  fetchGuestUsage: vi.fn(),
  claimGuestPractice: vi.fn(),
  fetchUserStatistics: vi.fn(),
  startPracticeSession: vi.fn(),
  fetchSessionAttempts: vi.fn(),
  submitSpellingAttempt: vi.fn(),
  submitAndRecordSpellingAttempt: vi.fn(),
  endPracticeSession: vi.fn(),
  createMockBeeRound: vi.fn(),
  submitMockBeeAttempt: vi.fn(),
  timeoutMockBee: vi.fn(),
  fetchMockBeeCurrentWordAudio: vi.fn(),
  fetchMockBeeReview: vi.fn(),
  confetti: vi.fn(),
}));

vi.mock("canvas-confetti", () => ({ default: mocks.confetti }));

vi.mock("@/components/VoiceMic", () => ({
  VoiceMic: ({
    onSpellingAttempt,
    onSupportResponse,
  }: {
    onSpellingAttempt: (attempt: string) => void;
    onSupportResponse?: (response: {
      intent: "definition" | "example_sentence" | "origin" | "repeat_word";
      transcript: string;
      audioBase64?: string;
    }) => void;
  }) => (
    <div>
      <button onClick={() => onSpellingAttempt("friend")}>Voice spelling</button>
      <button onClick={() => onSupportResponse?.({ intent: "definition", transcript: "definition" })}>Voice definition</button>
      <button onClick={() => onSupportResponse?.({ intent: "example_sentence", transcript: "example" })}>Voice example</button>
      <button onClick={() => onSupportResponse?.({ intent: "origin", transcript: "origin" })}>Voice origin</button>
      <button onClick={() => onSupportResponse?.({ intent: "repeat_word", transcript: "repeat" })}>Voice repeat</button>
      <button onClick={() => onSupportResponse?.({ intent: "repeat_word", transcript: "repeat", audioBase64: "audio" })}>Voice repeat with audio</button>
    </div>
  ),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: mocks.user, subscribed: mocks.subscribed, loading: false, configured: true,
    signOut: vi.fn(), signInWithPassword: vi.fn(), signUpWithPassword: vi.fn(),
    signInWithGoogle: vi.fn(), signInWithFacebook: vi.fn(),
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchNextWord: mocks.fetchNextWord,
    fetchForeignOrigins: mocks.fetchForeignOrigins,
    fetchCustomLists: mocks.fetchCustomLists,
    fetchCustomListWords: mocks.fetchCustomListWords,
    fetchForeignOriginDetails: mocks.fetchForeignOriginDetails,
    fetchPronunciationAudio: mocks.fetchPronunciationAudio,
    fetchGuestUsage: mocks.fetchGuestUsage,
    claimGuestPractice: mocks.claimGuestPractice,
    fetchUserStatistics: mocks.fetchUserStatistics,
    startPracticeSession: mocks.startPracticeSession,
    fetchSessionAttempts: mocks.fetchSessionAttempts,
    submitSpellingAttempt: mocks.submitSpellingAttempt,
    submitAndRecordSpellingAttempt: mocks.submitAndRecordSpellingAttempt,
    endPracticeSession: mocks.endPracticeSession,
  };
});

vi.mock("@/lib/mockBeeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mockBeeApi")>();
  return {
    ...actual,
    createMockBeeRound: mocks.createMockBeeRound,
    submitMockBeeAttempt: mocks.submitMockBeeAttempt,
    timeoutMockBee: mocks.timeoutMockBee,
    fetchMockBeeCurrentWordAudio: mocks.fetchMockBeeCurrentWordAudio,
    fetchMockBeeReview: mocks.fetchMockBeeReview,
  };
});

import Index from "@/pages/Index";
import MockBee from "@/pages/MockBee";
import { mockCoaching } from "@/lib/mocks";

const word = {
  word: "friend", level: "1", gradeBand: "K-2", difficulty: "easy", origin: "Old English",
  definition: "A person you trust.", exampleSentence: "My friend helped me.", partOfSpeech: "noun",
  pronunciation: "frend", patterns: [],
};

const timer = { secondsPerWord: 60, showCountdown: false, readyPromptAtElapsedSeconds: 45, revealAnswerOnSubmit: true };
const challenge = {
  turnIndex: 0, turnNumber: 1, timer,
  supports: { definition: word.definition, exampleSentence: "My ___ helped me.", origin: word.origin, partOfSpeech: "noun", gradeBand: "K-2", difficulty: "easy", level: "1" },
};
const session = {
  id: "bee-1", status: "active" as const,
  config: { level: "1" as const, wordSource: "standard" as const, wordCount: 10 as const, timer },
  progress: { totalWords: 10, currentTurnNumber: 1, answeredCount: 0, correctCount: 0, incorrectCount: 0, timedOutCount: 0 },
  currentChallenge: challenge, createdAt: "2026-07-17", updatedAt: "2026-07-17",
};
let latestPageAudio: { play: ReturnType<typeof vi.fn>; onended: null | (() => void); onerror: null | (() => void) } | null = null;

const coaching = mockCoaching({
  targetWord: "friend", childAttempt: "frend", level: 2, mode: "standard",
  definitionViewed: true, exampleViewed: false, originViewed: false,
  partOfSpeechViewed: false, repeatWordCount: 0, usedVoiceInput: false,
});

function renderPage(node: React.ReactNode) {
  return render(<MemoryRouter><TooltipProvider>{node}</TooltipProvider></MemoryRouter>);
}

describe("main application pages", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.user = null;
    mocks.subscribed = false;
    mocks.fetchForeignOrigins.mockResolvedValue({ origins: [{ origin: "Greek", wordCount: 4 }] });
    mocks.fetchCustomLists.mockResolvedValue({ lists: [] });
    mocks.fetchCustomListWords.mockResolvedValue([word]);
    mocks.fetchForeignOriginDetails.mockResolvedValue({ origin: "Greek", wordCount: 4, words: [word] });
    mocks.fetchPronunciationAudio.mockResolvedValue("blob:word");
    mocks.fetchGuestUsage.mockResolvedValue({
      guestToken: "test-guest-token",
      attemptsUsed: 0,
      attemptsRemaining: 30,
      limit: 30,
    });
    mocks.claimGuestPractice.mockResolvedValue(0);
    mocks.fetchUserStatistics.mockResolvedValue([]);
    mocks.fetchNextWord.mockResolvedValue(word);
    mocks.startPracticeSession.mockResolvedValue({ action: "created", sessionId: "practice-1" });
    mocks.fetchSessionAttempts.mockResolvedValue([]);
    mocks.endPracticeSession.mockResolvedValue(undefined);
    mocks.submitSpellingAttempt.mockImplementation(async (_request, handlers) => {
      handlers?.onMeta?.({ requestId: "request", isCorrect: false, timingMs: 1, targetWordMasked: true }, coaching);
      handlers?.onPrecomputed?.(coaching);
      handlers?.onSection?.("miss_analysis", coaching);
      handlers?.onSectionError?.({ section: "explanation", error: { code: "TIMEOUT", message: "timeout" }, timingMs: 2 });
      handlers?.onSectionError?.({ section: "explanation", error: { code: "TIMEOUT", message: "timeout" }, timingMs: 2 });
      handlers?.onDone?.(coaching, { complete: true, timings: { metaMs: 1, precomputedMs: 1, runtimeCoachingMs: 1, totalMs: 3 } });
      return coaching;
    });
    mocks.createMockBeeRound.mockResolvedValue(session);
    mocks.submitMockBeeAttempt.mockResolvedValue({
      session: { ...session, progress: { ...session.progress, answeredCount: 1, currentTurnNumber: 2, correctCount: 1 }, currentChallenge: { ...challenge, turnIndex: 1, turnNumber: 2 } },
      result: { turnIndex: 0, turnNumber: 1, isCorrect: true, timedOut: false, revealAnswer: true, correctWord: "friend" },
    });
    mocks.fetchMockBeeCurrentWordAudio.mockRejectedValue(new Error("audio unavailable"));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:audio") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.stubGlobal("Audio", vi.fn(() => {
      const audio = { play: vi.fn().mockResolvedValue(undefined), onended: null, onerror: null, preload: "", pause: vi.fn(), src: "", currentTime: 0 };
      latestPageAudio = audio;
      return audio;
    }));
  });

  afterEach(() => vi.useRealTimers());

  it("moves from the dashboard into standard practice and loads a selected level", async () => {
    renderPage(<Index />);
    expect(await screen.findByRole("button", { name: /Standard Practice/ })).toBeInTheDocument();
    expect(screen.getByText(/Master every word/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Standard Practice/ }));
    expect(screen.getByText("Choose your level")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Grades 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    await waitFor(() => expect(mocks.fetchNextWord).toHaveBeenCalledWith({ level: 1 }));
    expect(await screen.findByText("Hear the Word")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your spelling…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Definition/ }));
    expect(screen.getByText(word.definition)).toBeInTheDocument();
  });

  it("shows a friendly load error and returns to the dashboard", async () => {
    mocks.fetchNextWord.mockRejectedValueOnce(new Error("offline"));
    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Standard Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    expect(await screen.findByText("Could not load word. Check your connection.")).toBeInTheDocument();
    fireEvent.click(document.querySelector('button[title="Home"]')!);
    expect(await screen.findByText(/Master every word/)).toBeInTheDocument();
  });

  it("submits anonymous spelling with supports, streaming updates, audio, and prefetched next word", async () => {
    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Standard Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    await screen.findByPlaceholderText("Type your spelling…");
    for (const label of ["Definition", "Example Sentence", "Origin", "Part of Speech"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Hear the Word" }));
    await waitFor(() => expect(mocks.fetchPronunciationAudio).toHaveBeenCalledWith("friend"));

    const input = screen.getByPlaceholderText("Type your spelling…");
    fireEvent.change(input, { target: { value: " FREND " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mocks.submitSpellingAttempt).toHaveBeenCalled());
    expect(mocks.submitSpellingAttempt.mock.calls[0][0]).toMatchObject({
      targetWord: "friend", childAttempt: "frend", level: 2,
      definitionViewed: true, exampleViewed: true, originViewed: true, partOfSpeechViewed: true,
    });
    expect(await screen.findByText("Not quite!")).toBeInTheDocument();
    expect(screen.getByText(/Some coaching details could not be loaded/)).toBeInTheDocument();
    expect(mocks.fetchNextWord).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: /Next Word/ }));
    await waitFor(() => expect(screen.getByPlaceholderText("Type your spelling…")).toHaveValue(""));
  });

  it("surfaces anonymous submission and pronunciation failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.submitSpellingAttempt.mockRejectedValueOnce(new Error("Coach unavailable"));
    mocks.fetchPronunciationAudio.mockRejectedValueOnce(new Error("Audio unavailable"));
    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Standard Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    await screen.findByPlaceholderText("Type your spelling…");
    fireEvent.click(screen.getByRole("button", { name: "Hear the Word" }));
    expect(await screen.findByText("Could not play audio.")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Type your spelling…"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Coach unavailable")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("restores authenticated history, resolves an active-session conflict, persists, refreshes, and ends", async () => {
    mocks.user = { id: "user-1", email: "learner@example.com" };
    mocks.startPracticeSession
      .mockResolvedValueOnce({ action: "active_session_conflict", activeSessionId: "old", activeMode: "standard_level_1" })
      .mockResolvedValueOnce({ action: "created", sessionId: "practice-1" });
    mocks.fetchSessionAttempts.mockResolvedValue([
      {
        id: "old-1", session_id: "practice-1", user_id: "user-1", target_word: "rhythm", child_attempt: "rythm",
        is_correct: false, coaching_response: JSON.stringify(coaching), created_at: "2026-07-17T00:00:00Z",
        word_catalog_entry: { ...word, word: "rhythm" },
      },
      {
        id: "old-2", session_id: "practice-1", user_id: "user-1", target_word: "necessary", child_attempt: "necessary",
        is_correct: true, coaching_response: "legacy feedback", created_at: "2026-07-17T00:00:01Z",
        word_catalog_entry: { ...word, word: "necessary" },
      },
      {
        id: "ignored", session_id: "practice-1", user_id: "user-1", target_word: "missing", child_attempt: "missing",
        is_correct: true, coaching_response: null, created_at: "2026-07-17T00:00:02Z", word_catalog_entry: null,
      },
    ]);
    mocks.submitAndRecordSpellingAttempt.mockImplementation(async (_request, _attempt, handlers, options) => {
      handlers?.onMeta?.({ requestId: "persist", isCorrect: false, timingMs: 1, targetWordMasked: true }, coaching);
      handlers?.onDone?.(coaching, { complete: true, timings: { metaMs: 1, precomputedMs: 1, runtimeCoachingMs: 1, totalMs: 3 } });
      options?.onAttemptSaved?.("attempt-new");
      return {
        coaching,
        persistence: Promise.resolve({
          attemptId: "attempt-new",
          session: {
            id: "practice-1", mode: "standard_level_2", session_started_at: "invalid-date", session_ended_at: null,
            total_words_attempted: 3, total_correct: 1,
          },
        }),
      };
    });

    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Standard Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 4/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop Current And Start New" }));
    await waitFor(() => expect(mocks.startPracticeSession).toHaveBeenCalledTimes(2));
    expect(mocks.startPracticeSession).toHaveBeenLastCalledWith(expect.objectContaining({ forceCloseCurrent: true }));
    expect(await screen.findByText("rhythm")).toBeInTheDocument();
    expect(screen.getByText("necessary")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Type your spelling…"), { target: { value: "frend" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.submitAndRecordSpellingAttempt).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Not quite!")).toBeInTheDocument());
    window.dispatchEvent(new Event("pagehide"));
    await waitFor(() => expect(mocks.endPracticeSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "practice-1", totalWordsAttempted: 4 }),
      true,
    ));
    window.dispatchEvent(new Event("pageshow"));
    fireEvent.click(document.querySelector('button[title="Home"]')!);
    await waitFor(() => expect(mocks.endPracticeSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "practice-1", totalWordsAttempted: 4 })));
  });

  it("accepts voice callbacks and celebrates a correct level-one spelling", async () => {
    const correct = mockCoaching({
      targetWord: "friend", childAttempt: "friend", level: 1, mode: "standard",
      definitionViewed: true, exampleViewed: true, originViewed: true,
      partOfSpeechViewed: false, repeatWordCount: 0, usedVoiceInput: true,
    });
    mocks.submitAndRecordSpellingAttempt.mockImplementationOnce(async (_request, _attempt, handlers, options) => {
      handlers?.onDone?.(correct, { complete: true, timings: { metaMs: 1, precomputedMs: 1, runtimeCoachingMs: 1, totalMs: 3 } });
      options?.onAttemptSaved?.("attempt-voice");
      return {
        coaching: correct,
        persistence: Promise.resolve({
          attemptId: "attempt-voice",
          session: null,
        }),
      };
    });

    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Standard Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    await screen.findByPlaceholderText("Type your spelling…");
    fireEvent.click(screen.getByRole("button", { name: "Voice spelling" }));
    expect(screen.getByPlaceholderText("Type your spelling…")).toHaveValue("friend");
    for (const name of ["Voice definition", "Voice example", "Voice origin"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Voice repeat" }));
    await waitFor(() => expect(mocks.fetchPronunciationAudio).toHaveBeenCalledWith("friend"));
    mocks.fetchPronunciationAudio.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Voice repeat with audio" }));
    expect(mocks.fetchPronunciationAudio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(mocks.submitAndRecordSpellingAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ childAttempt: "friend", usedVoiceInput: true }),
      expect.objectContaining({ childAttempt: "friend", usedVoiceInput: true }),
      expect.anything(),
      expect.anything(),
    ));
    await waitFor(() => expect(mocks.confetti).toHaveBeenCalledTimes(3));
  });

  it("gates premium channels and reports an unresolvable session conflict", async () => {
    const anonymousView = renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /My Word Lists/ }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    anonymousView.unmount();

    mocks.user = { id: "free-user", email: "free@example.com" };
    const freeView = renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Language Origins/ }));
    expect(await screen.findByText("Unlock Premium Access")).toBeInTheDocument();
    freeView.unmount();

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.subscribed = true;
    mocks.startPracticeSession.mockResolvedValue({
      action: "active_session_conflict", activeSessionId: "stuck", activeMode: "standard_level_1",
    });
    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Standard Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grades 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop Current And Start New" }));
    expect(await screen.findByText("Could not close the previous practice session.")).toBeInTheDocument();
    expect(mocks.startPracticeSession).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("starts premium custom-list and foreign-origin sessions", async () => {
    mocks.user = { id: "premium", email: "premium@example.com" };
    mocks.subscribed = true;
    mocks.fetchCustomLists.mockResolvedValue({ lists: [{ id: "homework", name: "Homework", level: "2", wordCount: 1 }] });
    const customView = renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /My Word Lists/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Homework/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Practice "Homework"/ }));
    await waitFor(() => expect(mocks.startPracticeSession).toHaveBeenCalledWith(expect.objectContaining({ mode: "custom", customListId: "homework", customListName: "Homework" })));
    expect(mocks.fetchNextWord).toHaveBeenCalledWith(expect.objectContaining({ customListId: "homework" }));
    customView.unmount();

    vi.clearAllMocks();
    mocks.fetchForeignOrigins.mockResolvedValue({ origins: [{ origin: "Greek", wordCount: 4 }] });
    mocks.fetchForeignOriginDetails.mockResolvedValue({ origin: "Greek", wordCount: 4, words: [word] });
    mocks.startPracticeSession.mockResolvedValue({ action: "created", sessionId: "foreign-1" });
    mocks.fetchSessionAttempts.mockResolvedValue([]);
    mocks.fetchNextWord.mockResolvedValue(word);
    renderPage(<Index />);
    fireEvent.click(await screen.findByRole("button", { name: /Language Origins/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Greek/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Start Greek Practice" }));
    await waitFor(() => expect(mocks.startPracticeSession).toHaveBeenCalledWith(expect.objectContaining({ mode: "foreign_origin", originLanguage: "Greek" })));
    expect(mocks.fetchNextWord).toHaveBeenCalledWith(expect.objectContaining({ foreignOrigin: "Greek" }));
  });

  it("configures and starts a mock bee, opens supports, and submits an answer", async () => {
    renderPage(<MockBee />);
    expect(screen.getByRole("heading", { name: "Set up your round" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Level 3/ }));
    expect(screen.getByText("Answers shown only at the end")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    fireEvent.click(screen.getByRole("button", { name: /Level 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(mocks.createMockBeeRound).toHaveBeenCalled());
    expect(await screen.findByText(/Word 1 \/ 10/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Definition/ }));
    expect(screen.getByText(word.definition)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hear the Word" }));
    await waitFor(() => expect(mocks.fetchMockBeeCurrentWordAudio).toHaveBeenCalledWith("bee-1"));

    fireEvent.change(screen.getByPlaceholderText("Type your spelling…"), { target: { value: "friend" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    await waitFor(() => expect(mocks.submitMockBeeAttempt).toHaveBeenCalled());
    expect(await screen.findByText(/Correct/)).toBeInTheDocument();
  });

  it("shows the mock-bee start failure without leaving setup", async () => {
    mocks.createMockBeeRound.mockRejectedValueOnce(new Error("offline"));
    renderPage(<MockBee />);
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(await screen.findByText("Could not start the round. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Set up your round" })).toBeInTheDocument();
  });

  it("supports authenticated custom-list mock bee setup", async () => {
    mocks.user = { id: "user", email: "user@example.com" };
    mocks.fetchCustomLists.mockResolvedValue({ lists: [{ id: "list-1", name: "Competition", level: "3", wordCount: 20 }] });
    renderPage(<MockBee />);
    const custom = await screen.findByRole("button", { name: /My word lists/ });
    fireEvent.click(custom);
    fireEvent.click(await screen.findByRole("button", { name: /Competition/ }));
    fireEvent.click(screen.getByRole("button", { name: "30" }));
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await waitFor(() => expect(mocks.createMockBeeRound).toHaveBeenCalledWith(expect.objectContaining({
      wordSource: "custom_list", customListId: "list-1", wordCount: 30,
    })));
  });

  it("times out a round after audio, then renders completed, pending, and failed review cards", async () => {
    const shortTimer = { secondsPerWord: 1, showCountdown: true, revealAnswerOnSubmit: true };
    const timedSession = {
      ...session,
      config: { ...session.config, timer: shortTimer },
      currentChallenge: { ...challenge, timer: shortTimer },
    };
    const completedSession = {
      ...timedSession,
      status: "completed" as const,
      currentChallenge: null,
      progress: { ...timedSession.progress, answeredCount: 10, currentTurnNumber: 10, incorrectCount: 10, timedOutCount: 1 },
    };
    const completedWord = {
      turnIndex: 0, turnNumber: 1, word: "friend", status: "timed_out" as const, childAttempt: null, isCorrect: false,
      reviewCardStatus: "completed" as const, reviewCard: coaching, reviewError: null, supports: challenge.supports,
    };
    const pendingWord = { ...completedWord, turnIndex: 1, turnNumber: 2, word: "necessary", status: "submitted" as const, childAttempt: "necesary", reviewCardStatus: "pending" as const, reviewCard: null };
    const failedWord = { ...completedWord, turnIndex: 2, turnNumber: 3, word: "rhythm", status: "submitted" as const, childAttempt: "rythm", reviewCardStatus: "failed" as const, reviewCard: null, reviewError: "failed" };
    mocks.createMockBeeRound.mockResolvedValueOnce(timedSession);
    mocks.fetchMockBeeCurrentWordAudio.mockResolvedValueOnce("blob:word");
    mocks.timeoutMockBee.mockResolvedValueOnce({ session: completedSession, result: { turnIndex: 0, turnNumber: 1, isCorrect: false, timedOut: true, revealAnswer: false } });
    mocks.fetchMockBeeReview.mockResolvedValue({
      id: "bee-1", status: "completed", progress: completedSession.progress,
      reviewStatus: { not_started: 0, pending: 0, completed: 1, failed: 1 },
      words: [completedWord, pendingWord, failedWord],
    });

    renderPage(<MockBee />);
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await screen.findByText(/Word 1 \/ 10/);
    fireEvent.click(screen.getByRole("button", { name: "Hear the Word" }));
    await waitFor(() => expect(latestPageAudio?.play).toHaveBeenCalled());
    vi.useFakeTimers();
    act(() => latestPageAudio?.onended?.());
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTime(1250));
    await act(async () => Promise.resolve());
    vi.useRealTimers();

    expect(await screen.findByRole("heading", { name: "Round complete!" })).toBeInTheDocument();
    expect(screen.getByText("1 timed out")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /necessary/ }));
    expect(screen.getByText("Preparing feedback…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /rhythm/ }));
    expect(screen.getByText("Coaching unavailable for this word.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start a new round/ }));
    expect(screen.getByRole("heading", { name: "Set up your round" })).toBeInTheDocument();
  });

  it("keeps the mock-bee round usable after a submit failure", async () => {
    mocks.submitMockBeeAttempt.mockRejectedValueOnce(new Error("offline"));
    renderPage(<MockBee />);
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    await screen.findByText(/Word 1 \/ 10/);
    fireEvent.change(screen.getByPlaceholderText("Type your spelling…"), { target: { value: "friend" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Type your spelling…"), { key: "Enter" });
    await waitFor(() => expect(mocks.submitMockBeeAttempt).toHaveBeenCalled());
    expect(screen.getByText(/Word 1 \/ 10/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).not.toBeDisabled();
  });
});
