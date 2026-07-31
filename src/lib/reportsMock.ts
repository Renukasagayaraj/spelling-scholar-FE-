// Mock data for the Reports v1 spec. No API wiring — purely presentational.

export type DateRange = "7d" | "30d" | "90d" | "all";

export interface ReportsMock {
  overview: {
    totalAttempted: number;
    accuracy: number;
    totalCorrect: number;
    totalIncorrect: number;
    sessionsCompleted: number;
    avgAttemptsPerSession: number;
    practiceTimeMinutes: number;
    accuracyTrend: { date: string; accuracy: number }[];
    attemptsTrend: { date: string; attempts: number }[];
    byMode: { mode: string; attempts: number }[];
    byLevel: { level: string; attempts: number }[];
  };
  missAnalysis: {
    primary: { key: string; label: string; count: number }[];
    secondary: { key: string; label: string; count: number }[];
    byLevel: { level: string;[k: string]: number | string }[];
    byMode: { mode: string;[k: string]: number | string }[];
    recentIncorrect: {
      target: string;
      attempt: string;
      primary: string;
      secondary: string[];
      date: string;
      mode: string;
      level: string;
    }[];
    recentMissedWords: {
      target: string;
      attempt: string;
      primary: string;
      secondary: string[];
      date: string;
      mode: string;
      level: string;
    }[];
  };
  wordKnowledge: {
    byOrigin: { origin: string; attempts: number }[];
    byPos: { pos: string; attempts: number }[];
    byDifficulty: { difficulty: string; attempts: number }[];
    byGradeBand: { band: string; attempts: number }[];
    mostMissedOrigins: { origin: string; incorrect: number }[];
    recentByOrigin: { word: string; origin: string; date: string; correct: boolean }[];
    recentHard: { word: string; date: string; correct: boolean; origin: string }[];
    recentForeign: { word: string; origin: string; date: string; correct: boolean }[];
  };
  supportUsage: {
    definition: number;
    example: number;
    origin: number;
    partOfSpeech: number;
    repeat: number;
    voice: number;
    recentWithSupport: {
      word: string;
      date: string;
      supports: string[];
      mode: string;
      level: string;
      correct: boolean;
    }[];
    byMode: { mode: string; definition: number; example: number; origin: number; partOfSpeech: number; repeat: number; voice: number }[];
    byLevel: { level: string; definition: number; example: number; origin: number; partOfSpeech: number; repeat: number; voice: number }[];
  };
  sessions: {
    id: string;
    startedAt: string;
    mode: string;
    level: string;
    attempted: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    durationMinutes: number;
    topMissCategories: string[];
    supportsUsed: { definition: number; example: number; origin: number; partOfSpeech: number; repeat: number; voice: number };
    words: {
      target: string;
      attempt: string;
      correct: boolean;
      primaryError: string;
      secondaryErrors: string[];
      explanation: string;
      memoryTip: string;
      wordBreakdown: string;
      conceptTeaching: string;
      sayAloudTip: string;
    }[];
  }[];
  mockBee: {
    roundsCompleted: number;
    avgScore: number;
    accuracyByRound: { round: string; accuracy: number }[];
    timeoutsByRound: { round: string; timeouts: number }[];
    accuracyByLevel: { level: string; accuracy: number }[];
    rounds: {
      id: string;
      date: string;
      level: string;
      attempted: number;
      correct: number;
      incorrect: number;
      timedOut: number;
      reviewCards: unknown[];
    }[];
  };
}

export type ReportSection = keyof ReportsMock;
export type ReportSession = ReportsMock["sessions"][number];
export type ReportSessionWord = ReportSession["words"][number];

export interface ReportPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const days = (n: number) => {
  const out: string[] = [];
  const today = new Date("2026-07-16");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(5, 10)); // MM-DD
  }
  return out;
};

export const REPORTS_MOCK: ReportsMock = {
  overview: {
    totalAttempted: 284,
    accuracy: 72,
    totalCorrect: 204,
    totalIncorrect: 80,
    sessionsCompleted: 21,
    avgAttemptsPerSession: 13.5,
    practiceTimeMinutes: 312,
    accuracyTrend: days(14).map((date, i) => ({
      date,
      accuracy: 55 + Math.round(Math.sin(i / 2) * 8) + i,
    })),
    attemptsTrend: days(14).map((date, i) => ({
      date,
      attempts: 10 + Math.round(Math.abs(Math.cos(i / 1.5)) * 15) + (i % 3),
    })),
    byMode: [
      { mode: "Standard", attempts: 142 },
      { mode: "Custom", attempts: 58 },
      { mode: "Foreign Origin", attempts: 49 },
      { mode: "Mock Bee", attempts: 35 },
    ],
    byLevel: [
      { level: "Level 1", attempts: 96 },
      { level: "Level 2", attempts: 128 },
      { level: "Level 3", attempts: 60 },
    ],
  },
  missAnalysis: {
    primary: [
      { key: "vowel_confusion", label: "Vowel confusion", count: 22 },
      { key: "silent_letter_error", label: "Silent-letter error", count: 18 },
      { key: "double_letter_error", label: "Double-letter error", count: 14 },
      { key: "morphology_error", label: "Morphology error", count: 11 },
      { key: "missing_letter", label: "Missing letter", count: 9 },
      { key: "phonetic_spelling", label: "Phonetic spelling", count: 6 },
    ],
    secondary: [
      { key: "ending_confusion", label: "Ending confusion", count: 15 },
      { key: "chunk_omission", label: "Chunk omission", count: 12 },
      { key: "letter_transposition", label: "Letter order swap", count: 9 },
      { key: "consonant_cluster_error", label: "Consonant cluster error", count: 7 },
      { key: "likely_rushed", label: "Likely rushed", count: 5 },
    ],
    byLevel: [
      { level: "Level 1", Vowel: 6, Silent: 4, Double: 3, Morphology: 1 },
      { level: "Level 2", Vowel: 10, Silent: 8, Double: 6, Morphology: 5 },
      { level: "Level 3", Vowel: 6, Silent: 6, Double: 5, Morphology: 5 },
    ],
    byMode: [
      { mode: "Standard", Vowel: 12, Silent: 8, Double: 7, Morphology: 4 },
      { mode: "Custom", Vowel: 4, Silent: 3, Double: 2, Morphology: 3 },
      { mode: "Foreign", Vowel: 4, Silent: 5, Double: 3, Morphology: 3 },
      { mode: "Mock Bee", Vowel: 2, Silent: 2, Double: 2, Morphology: 1 },
    ],
    recentIncorrect: [
      { target: "rhythm", attempt: "rythm", primary: "Missing letter", secondary: ["Silent-letter error"], date: "Jul 15", mode: "Standard", level: "Level 2" },
      { target: "conscientious", attempt: "conshentious", primary: "Phonetic spelling", secondary: ["Pattern mismatch"], date: "Jul 15", mode: "Standard", level: "Level 3" },
      { target: "necessary", attempt: "neccessary", primary: "Double-letter error", secondary: [], date: "Jul 14", mode: "Custom", level: "Level 2" },
      { target: "bouquet", attempt: "boquet", primary: "Silent-letter error", secondary: ["Missing letter"], date: "Jul 14", mode: "Foreign Origin", level: "Level 3" },
      { target: "friend", attempt: "freind", primary: "Letter order swap", secondary: [], date: "Jul 13", mode: "Standard", level: "Level 1" },
      { target: "psychology", attempt: "sychology", primary: "Silent-letter error", secondary: [], date: "Jul 13", mode: "Foreign Origin", level: "Level 3" },
      { target: "believe", attempt: "beleive", primary: "Letter order swap", secondary: ["Vowel confusion"], date: "Jul 12", mode: "Standard", level: "Level 1" },
      { target: "separate", attempt: "seperate", primary: "Vowel confusion", secondary: [], date: "Jul 12", mode: "Standard", level: "Level 2" },
    ],
    recentMissedWords: [],
  },
  wordKnowledge: {
    byOrigin: [
      { origin: "Latin", attempts: 84 },
      { origin: "Greek", attempts: 52 },
      { origin: "French", attempts: 38 },
      { origin: "Old English", attempts: 61 },
      { origin: "Germanic", attempts: 27 },
      { origin: "Spanish", attempts: 12 },
      { origin: "Japanese", attempts: 10 },
    ],
    byPos: [
      { pos: "Noun", attempts: 128 },
      { pos: "Verb", attempts: 74 },
      { pos: "Adjective", attempts: 58 },
      { pos: "Adverb", attempts: 18 },
      { pos: "Other", attempts: 6 },
    ],
    byDifficulty: [
      { difficulty: "Easy", attempts: 110 },
      { difficulty: "Medium", attempts: 122 },
      { difficulty: "Hard", attempts: 52 },
    ],
    byGradeBand: [
      { band: "K–2", attempts: 82 },
      { band: "3–5", attempts: 138 },
      { band: "6–8", attempts: 64 },
    ],
    mostMissedOrigins: [
      { origin: "Greek", incorrect: 22 },
      { origin: "French", incorrect: 18 },
      { origin: "Latin", incorrect: 16 },
      { origin: "Japanese", incorrect: 6 },
      { origin: "Old English", incorrect: 12 },
    ],
    recentByOrigin: [
      { word: "psychology", origin: "Greek", date: "Jul 15", correct: false },
      { word: "bouquet", origin: "French", date: "Jul 14", correct: false },
      { word: "necessary", origin: "Latin", date: "Jul 14", correct: false },
      { word: "friend", origin: "Old English", date: "Jul 13", correct: false },
      { word: "karaoke", origin: "Japanese", date: "Jul 13", correct: true },
      { word: "rhythm", origin: "Greek", date: "Jul 15", correct: false },
    ],
    recentHard: [
      { word: "onomatopoeia", date: "Jul 15", correct: true, origin: "Greek" },
      { word: "conscientious", date: "Jul 15", correct: false, origin: "Latin" },
      { word: "bureaucracy", date: "Jul 14", correct: true, origin: "French" },
      { word: "psychology", date: "Jul 15", correct: false, origin: "Greek" },
    ],
    recentForeign: [
      { word: "bouquet", origin: "French", date: "Jul 14", correct: false },
      { word: "karaoke", origin: "Japanese", date: "Jul 13", correct: true },
      { word: "siesta", origin: "Spanish", date: "Jul 12", correct: true },
      { word: "rendezvous", origin: "French", date: "Jul 12", correct: false },
      { word: "tsunami", origin: "Japanese", date: "Jul 11", correct: true },
    ],
  },
  supportUsage: {
    definition: 62,
    example: 48,
    origin: 34,
    partOfSpeech: 22,
    repeat: 91,
    voice: 17,
    recentWithSupport: [
      { word: "conscientious", date: "Jul 15", supports: ["Definition", "Example", "Repeat"], mode: "Standard", level: "Level 3", correct: false },
      { word: "bouquet", date: "Jul 14", supports: ["Origin", "Repeat"], mode: "Foreign Origin", level: "Level 3", correct: false },
      { word: "rhythm", date: "Jul 15", supports: ["Definition"], mode: "Standard", level: "Level 2", correct: false },
      { word: "karaoke", date: "Jul 13", supports: ["Origin"], mode: "Foreign Origin", level: "Level 2", correct: true },
    ],
    byMode: [
      { mode: "Standard", definition: 30, example: 22, origin: 14, partOfSpeech: 10, repeat: 42, voice: 8 },
      { mode: "Custom", definition: 12, example: 8, origin: 4, partOfSpeech: 3, repeat: 18, voice: 2 },
      { mode: "Foreign", definition: 14, example: 12, origin: 12, partOfSpeech: 5, repeat: 20, voice: 4 },
      { mode: "Mock Bee", definition: 6, example: 6, origin: 4, partOfSpeech: 4, repeat: 11, voice: 3 },
    ],
    byLevel: [
      { level: "Level 1", definition: 18, example: 14, origin: 6, partOfSpeech: 5, repeat: 26, voice: 4 },
      { level: "Level 2", definition: 28, example: 20, origin: 14, partOfSpeech: 9, repeat: 40, voice: 7 },
      { level: "Level 3", definition: 16, example: 14, origin: 14, partOfSpeech: 8, repeat: 25, voice: 6 },
    ],
  },
  sessions: [
    { id: "s21", startedAt: "Jul 15, 5:12 PM", mode: "Standard", level: "Level 2", attempted: 14, correct: 10, incorrect: 4, accuracy: 71, durationMinutes: 18, topMissCategories: ["Vowel confusion", "Silent-letter"], supportsUsed: { definition: 3, example: 2, origin: 1, partOfSpeech: 0, repeat: 5, voice: 0 }, words: [] },
    { id: "s20", startedAt: "Jul 14, 4:40 PM", mode: "Foreign Origin", level: "Level 3", attempted: 12, correct: 7, incorrect: 5, accuracy: 58, durationMinutes: 22, topMissCategories: ["Silent-letter", "Missing letter"], supportsUsed: { definition: 2, example: 3, origin: 4, partOfSpeech: 0, repeat: 6, voice: 0 }, words: [] },
    { id: "s19", startedAt: "Jul 13, 3:15 PM", mode: "Custom", level: "Level 2", attempted: 16, correct: 13, incorrect: 3, accuracy: 81, durationMinutes: 15, topMissCategories: ["Double letter"], supportsUsed: { definition: 4, example: 2, origin: 0, partOfSpeech: 0, repeat: 6, voice: 0 }, words: [] },
    { id: "s18", startedAt: "Jul 12, 6:02 PM", mode: "Mock Bee", level: "Level 2", attempted: 10, correct: 6, incorrect: 4, accuracy: 60, durationMinutes: 8, topMissCategories: ["Likely rushed"], supportsUsed: { definition: 1, example: 1, origin: 0, partOfSpeech: 0, repeat: 3, voice: 0 }, words: [] },
  ],
  mockBee: {
    roundsCompleted: 9,
    avgScore: 7.2,
    accuracyByRound: [
      { round: "R1", accuracy: 60 },
      { round: "R2", accuracy: 70 },
      { round: "R3", accuracy: 55 },
      { round: "R4", accuracy: 80 },
      { round: "R5", accuracy: 72 },
      { round: "R6", accuracy: 90 },
    ],
    timeoutsByRound: [
      { round: "R1", timeouts: 3 },
      { round: "R2", timeouts: 2 },
      { round: "R3", timeouts: 4 },
      { round: "R4", timeouts: 1 },
      { round: "R5", timeouts: 2 },
      { round: "R6", timeouts: 0 },
    ],
    accuracyByLevel: [
      { level: "Level 1", accuracy: 84 },
      { level: "Level 2", accuracy: 71 },
      { level: "Level 3", accuracy: 58 },
    ],
    rounds: [
      { id: "r6", date: "Jul 15", level: "Level 2", attempted: 10, correct: 9, incorrect: 1, timedOut: 0, reviewCards: [] },
      { id: "r5", date: "Jul 14", level: "Level 3", attempted: 10, correct: 7, incorrect: 2, timedOut: 1, reviewCards: [] },
      { id: "r4", date: "Jul 13", level: "Level 2", attempted: 10, correct: 8, incorrect: 1, timedOut: 1, reviewCards: [] },
      { id: "r3", date: "Jul 12", level: "Level 3", attempted: 10, correct: 5, incorrect: 3, timedOut: 2, reviewCards: [] },
    ],
  },
};
