// Mock Bee session API client.
// Calls the backend through the same base URL convention as src/lib/api.ts
// (defaults to "" so the Vite dev proxy forwards /api → http://localhost:3001).
// Set VITE_MOCK_BEE_FALLBACK=1 to force the in-memory mock for preview/demo.

import { getAccessToken } from "@/lib/supabase";
import { UnauthorizedError } from "@/lib/api";
import type { CoachingResponse, ChildProfile, SupportsUsed, WordData } from "@/lib/api";
import { mockCoaching } from "@/lib/mocks";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const USE_MOCK_FALLBACK = import.meta.env.VITE_MOCK_BEE_FALLBACK === "1";

export type MockBeeLevel = "1" | "2" | "3";
export type MockBeeWordSource = "standard" | "custom_list";
export type MockBeeWordCount = 10 | 20 | 30;

export interface MockBeeTimer {
  secondsPerWord: number;
  showCountdown: boolean;
  readyPromptAtElapsedSeconds?: number;
  revealAnswerOnSubmit: boolean;
}

export interface MockBeeSupports {
  definition: string;
  exampleSentence: string;
  origin: string;
  partOfSpeech: string;
  gradeBand: string;
  difficulty: string;
  level: string;
}

export interface MockBeeChallenge {
  turnIndex: number;
  turnNumber: number;
  timer: MockBeeTimer;
  supports: MockBeeSupports;
}

export interface MockBeeProgress {
  totalWords: number;
  currentTurnNumber: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  timedOutCount: number;
}

export interface MockBeeSession {
  id: string;
  status: "active" | "completed";
  config: {
    level: MockBeeLevel;
    wordSource: MockBeeWordSource;
    wordCount: MockBeeWordCount;
    timer: MockBeeTimer;
  };
  progress: MockBeeProgress;
  currentChallenge: MockBeeChallenge | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoundRequest {
  level: MockBeeLevel;
  wordSource: MockBeeWordSource;
  customListId?: string;
  wordCount: MockBeeWordCount;
  childProfile: ChildProfile;
}

export interface SubmitRequest {
  childAttempt: string;
  supportsUsed: SupportsUsed;
}

export interface SubmitResult {
  turnIndex: number;
  turnNumber: number;
  isCorrect: boolean;
  timedOut: boolean;
  revealAnswer: boolean;
  correctWord?: string;
}

export interface SubmitResponse {
  session: MockBeeSession;
  result: SubmitResult;
}

export type ReviewCardStatus = "not_started" | "pending" | "completed" | "failed";

export interface ReviewWord {
  turnIndex: number;
  turnNumber: number;
  word: string;
  status: "submitted" | "timed_out";
  childAttempt: string | null;
  isCorrect: boolean;
  reviewCardStatus: ReviewCardStatus;
  reviewCard: CoachingResponse | null;
  reviewError: string | null;
  supports: MockBeeSupports;
}

export interface ReviewResponse {
  review: {
    id: string;
    status: "completed";
    progress: MockBeeProgress;
    reviewStatus: { not_started: number; pending: number; completed: number; failed: number };
    words: ReviewWord[];
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const TIMER_BY_LEVEL: Record<MockBeeLevel, MockBeeTimer> = {
  "1": { secondsPerWord: 60, showCountdown: false, readyPromptAtElapsedSeconds: 45, revealAnswerOnSubmit: true },
  "2": { secondsPerWord: 45, showCountdown: true, revealAnswerOnSubmit: true },
  "3": { secondsPerWord: 30, showCountdown: true, revealAnswerOnSubmit: false },
};

// ===== Real API calls =====

export async function createMockBeeRound(req: CreateRoundRequest): Promise<MockBeeSession> {
  if (USE_MOCK_FALLBACK) return mockCreateRound(req);
  const res = await fetch(`${BASE_URL}/api/mock-bee/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(req),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error("Failed to create mock bee round");
  const data = await res.json();
  return data.session;
}

export async function getMockBeeSession(id: string): Promise<MockBeeSession> {
  if (USE_MOCK_FALLBACK) return mockGetSession(id);
  const res = await fetch(`${BASE_URL}/api/mock-bee/sessions/${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch mock bee session");
  const data = await res.json();
  return data.session;
}

export async function submitMockBeeAttempt(id: string, body: SubmitRequest): Promise<SubmitResponse> {
  if (USE_MOCK_FALLBACK) return mockSubmit(id, body);
  const res = await fetch(`${BASE_URL}/api/mock-bee/sessions/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to submit attempt");
  return res.json();
}

export async function timeoutMockBee(id: string): Promise<SubmitResponse> {
  if (USE_MOCK_FALLBACK) return mockTimeout(id);
  const res = await fetch(`${BASE_URL}/api/mock-bee/sessions/${encodeURIComponent(id)}/timeout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: "{}",
  });
  if (!res.ok) throw new Error("Failed to register timeout");
  return res.json();
}

export async function fetchMockBeeCurrentWordAudio(id: string): Promise<string> {
  if (USE_MOCK_FALLBACK) return mockCurrentAudio(id);
  const res = await fetch(
    `${BASE_URL}/api/mock-bee/sessions/${encodeURIComponent(id)}/current-word/pronunciation`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to fetch pronunciation");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchMockBeeReview(id: string): Promise<ReviewResponse["review"]> {
  if (USE_MOCK_FALLBACK) return mockReview(id);
  const res = await fetch(`${BASE_URL}/api/mock-bee/sessions/${encodeURIComponent(id)}/review`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch review");
  const data: ReviewResponse = await res.json();
  return data.review;
}

// ===== Mock implementation =====

interface MockState {
  session: MockBeeSession;
  words: WordData[];
  attempts: Array<{ attempt: string | null; isCorrect: boolean; timedOut: boolean }>;
  reviewReadyAt: number; // ms timestamp when review cards become "completed"
}

const MOCK_STORE = new Map<string, MockState>();

const MOCK_POOL: WordData[] = [
  { word: "friend", level: "1", gradeBand: "K-2", difficulty: "easy", origin: "Old English", definition: "A person you trust.", exampleSentence: "My ___ helped me.", partOfSpeech: "noun", pronunciation: "frend", patterns: [] },
  { word: "school", level: "1", gradeBand: "K-2", difficulty: "easy", origin: "Greek", definition: "A place where students learn.", exampleSentence: "I walk to ___ every day.", partOfSpeech: "noun", pronunciation: "skool", patterns: [] },
  { word: "rhythm", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Greek", definition: "A regular repeated pattern.", exampleSentence: "She danced to the ___.", partOfSpeech: "noun", pronunciation: "RITH-uhm", patterns: [] },
  { word: "necessary", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Latin", definition: "Required.", exampleSentence: "Sleep is ___.", partOfSpeech: "adjective", pronunciation: "NES-uh-ser-ee", patterns: [] },
  { word: "accommodate", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Latin", definition: "To make room for.", exampleSentence: "The hall can ___ 100 people.", partOfSpeech: "verb", pronunciation: "uh-KOM-uh-dayt", patterns: [] },
  { word: "onomatopoeia", level: "3", gradeBand: "6-8", difficulty: "hard", origin: "Greek", definition: "A word that imitates a sound.", exampleSentence: "'Buzz' is an example of ___.", partOfSpeech: "noun", pronunciation: "on-uh-mat-uh-PEE-uh", patterns: [] },
  { word: "conscientious", level: "3", gradeBand: "6-8", difficulty: "hard", origin: "Latin", definition: "Careful and thorough.", exampleSentence: "She is a ___ student.", partOfSpeech: "adjective", pronunciation: "kon-shee-EN-shuhs", patterns: [] },
  { word: "embarrass", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "French", definition: "To make someone feel awkward.", exampleSentence: "Don't ___ me!", partOfSpeech: "verb", pronunciation: "em-BAIR-uhs", patterns: [] },
  { word: "mischievous", level: "3", gradeBand: "6-8", difficulty: "hard", origin: "Old French", definition: "Playfully naughty.", exampleSentence: "The ___ kitten knocked over the vase.", partOfSpeech: "adjective", pronunciation: "MIS-chuh-vuhs", patterns: [] },
  { word: "separate", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Latin", definition: "Set apart.", exampleSentence: "Please ___ the recycling.", partOfSpeech: "verb", pronunciation: "SEP-uh-rayt", patterns: [] },
];

function pickWords(count: number, level: MockBeeLevel): WordData[] {
  const filtered = MOCK_POOL.filter((w) => w.level === level);
  const pool = filtered.length >= 3 ? filtered : MOCK_POOL;
  const out: WordData[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

function maskedSupports(w: WordData, level: MockBeeLevel): MockBeeSupports {
  return {
    definition: w.definition,
    exampleSentence: w.exampleSentence.replace(new RegExp(w.word, "ig"), "___"),
    origin: w.origin,
    partOfSpeech: w.partOfSpeech,
    gradeBand: w.gradeBand,
    difficulty: w.difficulty,
    level,
  };
}

function buildChallenge(state: MockState): MockBeeChallenge | null {
  const idx = state.session.progress.answeredCount;
  if (idx >= state.words.length) return null;
  const w = state.words[idx];
  return {
    turnIndex: idx,
    turnNumber: idx + 1,
    timer: state.session.config.timer,
    supports: maskedSupports(w, state.session.config.level),
  };
}

function mockCreateRound(req: CreateRoundRequest): MockBeeSession {
  const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timer = TIMER_BY_LEVEL[req.level];
  const words = pickWords(req.wordCount, req.level);
  const state: MockState = {
    session: {
      id,
      status: "active",
      config: { level: req.level, wordSource: req.wordSource, wordCount: req.wordCount, timer },
      progress: {
        totalWords: req.wordCount,
        currentTurnNumber: 1,
        answeredCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        timedOutCount: 0,
      },
      currentChallenge: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    words,
    attempts: [],
    reviewReadyAt: 0,
  };
  state.session.currentChallenge = buildChallenge(state);
  MOCK_STORE.set(id, state);
  return state.session;
}

function mockGetSession(id: string): MockBeeSession {
  const s = MOCK_STORE.get(id);
  if (!s) throw new Error("Unknown session");
  return s.session;
}

function advance(state: MockState, attempt: string | null, isCorrect: boolean, timedOut: boolean): SubmitResult {
  const idx = state.session.progress.answeredCount;
  const target = state.words[idx];
  const result: SubmitResult = {
    turnIndex: idx,
    turnNumber: idx + 1,
    isCorrect,
    timedOut,
    revealAnswer: state.session.config.timer.revealAnswerOnSubmit && !timedOut,
    correctWord: state.session.config.timer.revealAnswerOnSubmit && !timedOut ? target.word : undefined,
  };
  state.attempts.push({ attempt, isCorrect, timedOut });
  state.session.progress.answeredCount += 1;
  if (isCorrect) state.session.progress.correctCount += 1;
  else state.session.progress.incorrectCount += 1;
  if (timedOut) state.session.progress.timedOutCount += 1;
  state.session.progress.currentTurnNumber = Math.min(
    state.session.progress.answeredCount + 1,
    state.words.length,
  );
  if (state.session.progress.answeredCount >= state.words.length) {
    state.session.status = "completed";
    state.session.currentChallenge = null;
    // Simulate async coaching: review cards become "completed" after a short delay
    state.reviewReadyAt = Date.now() + 1500;
  } else {
    state.session.currentChallenge = buildChallenge(state);
  }
  state.session.updatedAt = new Date().toISOString();
  return result;
}

function mockSubmit(id: string, body: SubmitRequest): SubmitResponse {
  const state = MOCK_STORE.get(id);
  if (!state) throw new Error("Unknown session");
  const idx = state.session.progress.answeredCount;
  const target = state.words[idx];
  const isCorrect = body.childAttempt.trim().toLowerCase() === target.word.toLowerCase();
  const result = advance(state, body.childAttempt, isCorrect, false);
  return { session: state.session, result };
}

function mockTimeout(id: string): SubmitResponse {
  const state = MOCK_STORE.get(id);
  if (!state) throw new Error("Unknown session");
  const result = advance(state, null, false, true);
  return { session: state.session, result };
}

function mockCurrentAudio(id: string): string {
  const state = MOCK_STORE.get(id);
  if (!state || !state.session.currentChallenge) throw new Error("No current word");
  const idx = state.session.currentChallenge.turnIndex;
  const word = state.words[idx].word;
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    }
  } catch {
    // ignore
  }
  const SILENT_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  const bytes = Uint8Array.from(atob(SILENT_WAV_BASE64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function mockReview(id: string): ReviewResponse["review"] {
  const state = MOCK_STORE.get(id);
  if (!state) throw new Error("Unknown session");
  const ready = Date.now() >= state.reviewReadyAt;
  const words: ReviewWord[] = state.words.map((w, i) => {
    const a = state.attempts[i];
    const reviewCardStatus: ReviewCardStatus = ready ? "completed" : "pending";
    const reviewCard = ready
      ? mockCoaching({
          targetWord: w.word,
          childAttempt: a?.attempt || "",
          childProfile: { childId: "c1", age: 10, grade: "5", spellingLevel: `level_${state.session.config.level}` },
          supportsUsed: { definitionViewed: false, exampleViewed: false, originViewed: false },
          sessionContext: { mode: "mock_bee", previousAttemptsOnThisWord: 1, previousMissPatterns: [], recentlyPracticedWords: [] },
        })
      : null;
    return {
      turnIndex: i,
      turnNumber: i + 1,
      word: w.word,
      status: a?.timedOut ? "timed_out" : "submitted",
      childAttempt: a?.attempt ?? null,
      isCorrect: !!a?.isCorrect,
      reviewCardStatus,
      reviewCard,
      reviewError: null,
      supports: maskedSupports(w, state.session.config.level),
    };
  });
  const reviewStatus = {
    not_started: 0,
    pending: ready ? 0 : words.length,
    completed: ready ? words.length : 0,
    failed: 0,
  };
  return {
    id,
    status: "completed",
    progress: state.session.progress,
    reviewStatus,
    words,
  };
}
