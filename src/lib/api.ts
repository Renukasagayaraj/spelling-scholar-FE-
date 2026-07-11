import { getAccessToken, supabase } from "@/lib/supabase";
import { mockNextWord, mockCoaching, mockPronunciationAudio } from "@/lib/mocks";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
// When no backend URL is configured (preview/local without API server),
// fall back to mocks so the full UI — pronunciation, coaching feedback —
// is exercisable. Set VITE_API_BASE_URL to disable.
const USE_MOCK_FALLBACK = !BASE_URL;

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle401(): Promise<never> {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await supabase.auth.signOut({ scope: "local" });
  }
  throw new UnauthorizedError();
}

export interface WordData {
  word: string;
  level: string;
  gradeBand: string;
  difficulty: string;
  origin: string;
  definition: string;
  exampleSentence: string;
  partOfSpeech: string;
  pronunciation: string;
  patterns: string[];
}

export interface SupportsUsed {
  definitionViewed: boolean;
  exampleViewed: boolean;
  originViewed: boolean;
  partOfSpeechViewed?: boolean;
}

export interface ChildProfile {
  childId: string;
  age: number;
  grade: string;
  spellingLevel: string;
}

export interface SessionContext {
  mode: string;
  previousAttemptsOnThisWord: number;
  previousMissPatterns: string[];
  recentlyPracticedWords: string[];
}

export interface CoachingRequest {
  targetWord: string;
  childAttempt: string;
  childProfile: ChildProfile;
  supportsUsed: SupportsUsed;
  sessionContext: SessionContext;
  definition?: string;
  exampleSentence?: string;
  origin?: string;
  partOfSpeech?: string;
  level?: number;
}

export interface CoachingResponse {
  correctness: {
    isCorrect: boolean;
    reinforceSuccess: boolean;
  };
  missAnalysis: {
    summary: string;
    errorTypes: string[];
    primaryErrorFocus: string;
    likelyWrongWordInterpretation: boolean;
    usedMeaningDisambiguationWell: boolean;
  };
  wordTeaching: {
    formTeaching: {
      summary: string;
      patterns: string[];
      chunks: string[];
      chunkReason: string;
      sayAloudFocus: string;
    };
    conceptTeaching: {
      summary: string;
      meaningFocus: string;
      originFocus: string;
      morphologyFocus: string;
      originLabels: string[];
      morphologyLabels: string[];
      relatedForms?: string[];
    };
  };
  errorRelevance: {
    mostRelevantToError: string;
    confidence: number;
    reason: string;
  };
  teachingDecision: {
    strategy: string;
    primaryFocus: string;
    secondaryFocuses: string[];
    confidence: number;
    rationale: string;
  };
  coachingText: {
    shortFeedback: string;
    fullExplanation: string;
    memoryTip: string;
    sayAloudTip: string;
  };
  wordBreakdown: {
    displayChunks: string[];
    chunkReason: string;
    matchedPatterns: {
      label: string;
      matchedText?: string;
      matchedParts?: string[];
    }[];
  };
  conceptLabels: {
    originLabels: string[];
    patternLabels: string[];
    morphologyLabels: string[];
  };
  nextStep: {
    practiceFocus: string;
    shouldReviewSoon: boolean;
    suggestedSimilarWordTypes: string[];
  };
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export interface CustomListSummary {
  id: string;
  name: string;
  level: string;
  wordCount: number;
}

export interface ImportCustomListRequest {
  listName: string;
  words: string[];
  overwriteList: boolean;
}

export interface ImportCustomListResponse {
  list: CustomListSummary;
  importedCount: number;
  skippedExistingCount: number;
  words: WordData[];
}

export interface CustomListsResponse {
  lists: CustomListSummary[];
}

export interface CustomListDetailResponse {
  list: CustomListSummary & {
    words: WordData[];
  };
}

export interface ForeignOriginSummary {
  origin: string;
  wordCount: number;
}

export interface ForeignOriginsResponse {
  origins: ForeignOriginSummary[];
}

export interface ForeignOriginDetail extends ForeignOriginSummary {
  words: WordData[];
}

export interface ForeignOriginDetailResponse {
  origin: ForeignOriginDetail;
}

export interface NextWordParams {
  level?: number;
  customListId?: string;
  foreignOrigin?: string;
  exclude?: string[];
}

export async function fetchNextWord(
  paramsOrLevel?: number | NextWordParams,
  customListId?: string,
): Promise<WordData> {
  // Backwards-compatible signature: fetchNextWord(level, customListId)
  const opts: NextWordParams =
    typeof paramsOrLevel === "object" && paramsOrLevel !== null
      ? paramsOrLevel
      : { level: paramsOrLevel as number | undefined, customListId };

  const params = new URLSearchParams();
  // Mode precedence: foreignOrigin > customListId > level. Never mix.
  if (opts.foreignOrigin) {
    params.set("foreignOrigin", opts.foreignOrigin);
  } else if (opts.customListId) {
    params.set("customListId", opts.customListId);
  } else if (opts.level != null) {
    params.set("level", String(opts.level));
  }
  if (opts.exclude && opts.exclude.length > 0) {
    params.set("exclude", opts.exclude.join(","));
  }
  // Custom list practice requires auth; level/foreignOrigin are public.
  const headers = opts.customListId ? await authHeaders() : {};
  try {
    const res = await fetch(`${BASE_URL}/api/words/next?${params}`, { headers });
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to fetch word");
    return await res.json();
  } catch (err) {
    if (USE_MOCK_FALLBACK && !(err instanceof UnauthorizedError)) {
      return mockNextWord(opts);
    }
    throw err;
  }
}

// Module-level promise caches. These endpoints return data that rarely changes
// during a session, so we dedupe + cache across all components/mounts.
// Invalidate explicitly after mutations (import list) or auth changes.
let foreignOriginsCache: Promise<ForeignOriginsResponse> | null = null;
let customListsCache: Promise<CustomListsResponse> | null = null;

export function invalidateForeignOriginsCache() {
  foreignOriginsCache = null;
}
export function invalidateCustomListsCache() {
  customListsCache = null;
}

export async function fetchForeignOrigins(): Promise<ForeignOriginsResponse> {
  if (foreignOriginsCache) return foreignOriginsCache;
  foreignOriginsCache = (async () => {
    const res = await fetch(`${BASE_URL}/api/foreign-origins`);
    if (!res.ok) throw new Error("Failed to fetch foreign origins");
    return res.json();
  })().catch((err) => {
    foreignOriginsCache = null;
    throw err;
  });
  return foreignOriginsCache;
}

export async function fetchForeignOriginDetails(origin: string): Promise<ForeignOriginDetail> {
  const res = await fetch(`${BASE_URL}/api/foreign-origins/${encodeURIComponent(origin)}`);
  if (!res.ok) throw new Error("Failed to fetch foreign origin details");
  const data: ForeignOriginDetailResponse = await res.json();
  return data.origin;
}

export async function fetchCustomLists(): Promise<CustomListsResponse> {
  if (customListsCache) return customListsCache;
  customListsCache = (async () => {
    const res = await fetch(`${BASE_URL}/api/custom-lists`, { headers: await authHeaders() });
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to fetch custom lists");
    return res.json();
  })().catch((err) => {
    customListsCache = null;
    throw err;
  });
  return customListsCache;
}

export async function fetchCustomListWords(listId: string): Promise<WordData[]> {
  const res = await fetch(`${BASE_URL}/api/custom-lists/${encodeURIComponent(listId)}`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to fetch custom list words");
  const data = await res.json();

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.words)) return data.words;
  if (Array.isArray(data?.list?.words)) return data.list.words;

  return [];
}

export async function importCustomWordList(payload: ImportCustomListRequest): Promise<ImportCustomListResponse> {
  const res = await fetch(`${BASE_URL}/api/words/import-custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to import custom list");
  invalidateCustomListsCache();
  return res.json();
}

export async function fetchPronunciationAudio(word: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/words/${encodeURIComponent(word)}/pronunciation`);
    if (!res.ok) throw new Error("Failed to fetch pronunciation");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    if (USE_MOCK_FALLBACK) return mockPronunciationAudio(word);
    throw err;
  }
}

export async function submitSpellingAttempt(body: CoachingRequest): Promise<CoachingResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/spelling-coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to submit attempt");
    return await res.json();
  } catch (err) {
    if (USE_MOCK_FALLBACK) return mockCoaching(body);
    throw err;
  }
}

export interface SubscriptionStatus {
  subscribed: boolean;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  if (USE_MOCK_FALLBACK) {
    const isSub = localStorage.getItem("mock_subscribed") === "true";
    return {
      subscribed: isSub,
      currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
      cancelAtPeriodEnd: false,
    };
  }
  const res = await fetch(`${BASE_URL}/api/stripe/subscription-status`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to fetch subscription status");
  return res.json();
}

export async function createStripeCheckoutSession(): Promise<{ url: string }> {
  if (USE_MOCK_FALLBACK) {
    localStorage.setItem("mock_subscribed", "true");
    return { url: `${window.location.origin}/?payment_success=true` };
  }
  const res = await fetch(`${BASE_URL}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
  });
  if (res.status === 401) await handle401();
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to create checkout session");
  }
  return res.json();
}

export async function createStripePortalSession(): Promise<{ url: string }> {
  if (USE_MOCK_FALLBACK) {
    return { url: window.location.origin };
  }
  const res = await fetch(`${BASE_URL}/api/stripe/create-portal-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
  });
  if (res.status === 401) await handle401();
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to create portal session");
  }
  return res.json();
}

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  theme_preference: string;
  audio_enabled: boolean;
  child_id: string | null;
  age: number | null;
  grade: string | null;
  spelling_level: string | null;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  if (USE_MOCK_FALLBACK) {
    const cached = localStorage.getItem("mock_user_profile");
    if (cached) return JSON.parse(cached);
    const mock: UserProfile = {
      id: "mock-user-id",
      email: "test@example.com",
      full_name: "Mock Student",
      theme_preference: "default",
      audio_enabled: true,
      child_id: "c1",
      age: 10,
      grade: "5",
      spelling_level: "competition",
    };
    localStorage.setItem("mock_user_profile", JSON.stringify(mock));
    return mock;
  }
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to fetch user profile");
  const data = await res.json();
  return data.profile;
}

export async function updateUserProfile(updates: Partial<Omit<UserProfile, "id" | "email">>): Promise<UserProfile> {
  if (USE_MOCK_FALLBACK) {
    const profile = await fetchUserProfile();
    const updated = { ...profile, ...updates };
    localStorage.setItem("mock_user_profile", JSON.stringify(updated));
    return updated;
  }
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(updates),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to update user profile");
  const data = await res.json();
  return data.profile;
}

export interface PracticeSessionRecord {
  id: string;
  user_id: string;
  mode: string;
  session_started_at: string;
  session_ended_at?: string;
  total_words_attempted?: number;
  total_correct?: number;
  accuracy_percentage?: number;
  duration_seconds?: number;
  created_at: string;
}

export interface WordAttemptRecord {
  id: string;
  session_id: string;
  user_id: string;
  target_word: string;
  child_attempt: string;
  is_correct: boolean;
  level?: number;
  definition_viewed?: boolean;
  example_viewed?: boolean;
  origin_viewed?: boolean;
  part_of_speech_viewed?: boolean;
  repeat_word_count?: number;
  used_voice_input?: boolean;
  created_at: string;
}

export async function startPracticeSession(mode: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/sessions/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ mode }),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to start practice session");
  const data = await res.json();
  return data.sessionId;
}

export interface RecordAttemptBody {
  sessionId: string;
  targetWord: string;
  childAttempt: string;
  isCorrect: boolean;
  level?: number;
  mode?: string;
  definitionViewed?: boolean;
  exampleViewed?: boolean;
  originViewed?: boolean;
  partOfSpeechViewed?: boolean;
  repeatWordCount?: number;
  usedVoiceInput?: boolean;
  coachingResponse?: string;
}

export async function recordWordAttempt(body: RecordAttemptBody): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/sessions/attempts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to record word attempt");
  const data = await res.json();
  return data.attemptId;
}

export interface EndSessionBody {
  sessionId: string;
  totalWordsAttempted: number;
  totalCorrect: number;
  durationSeconds: number;
}

export async function endPracticeSession(body: EndSessionBody, keepAlive?: boolean): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/sessions/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
    keepalive: keepAlive,
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to end practice session");
}

export interface DbUserStats {
  mode: string;
  level: number | null;
  current_streak: number;
  best_streak: number;
  total_attempts: number;
  correct_attempts: number;
  badges: string[];
}

export async function fetchUserStatistics(): Promise<DbUserStats[]> {
  if (USE_MOCK_FALLBACK) {
    return [];
  }
  const res = await fetch(`${BASE_URL}/api/users/stats`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to fetch user statistics");
  const data = await res.json();
  return data.stats;
}

export interface DbWordAttempt {
  id: string;
  session_id: string;
  user_id: string;
  target_word: string;
  child_attempt: string;
  is_correct: boolean;
  level?: number;
  definition_viewed?: boolean;
  example_viewed?: boolean;
  origin_viewed?: boolean;
  part_of_speech_viewed?: boolean;
  repeat_word_count?: number;
  used_voice_input?: boolean;
  created_at: string;
  word_catalog_entry?: Partial<WordData> | null;
}

export async function fetchSessionAttempts(sessionId: string): Promise<DbWordAttempt[]> {
  if (USE_MOCK_FALLBACK) {
    return [];
  }
  const res = await fetch(`${BASE_URL}/api/sessions/attempts?sessionId=${encodeURIComponent(sessionId)}`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to fetch session attempts");
  const data = await res.json();
  return data.attempts;
}


