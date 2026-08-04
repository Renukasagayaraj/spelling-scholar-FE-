import { getAccessToken, supabase } from "@/lib/supabase";
import { mockNextWord, mockCoaching, mockPronunciationAudio } from "@/lib/mocks";
import type {
  ReportPagination,
  ReportSection,
  ReportSessionWord,
  ReportsMock,
} from "@/lib/reportsMock";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
// Some non-coaching APIs retain preview/local mocks when no backend URL is
// configured. Streaming coaching always surfaces connection failures.
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
  if (data?.session) {
    await supabase.auth.signOut({ scope: "local" });
  }
  throw new UnauthorizedError();
}

export interface MorphemeGloss {
  part: string;
  role: string;
  meaning: string;
  origin?: string;
}

export interface WordData {
  word: string;
  level: string;
  gradeBand: string;
  difficulty: string;
  origin: string;
  mainOrigin?: string;
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

export type SpellingCoachStreamSection =
  | "short_feedback"
  | "miss_analysis"
  | "explanation"
  | "memory_tip";

export type SpellingCoachRuntimeSectionStatus =
  | "idle"
  | "streaming"
  | "complete"
  | "error";

export interface SpellingCoachRuntimeSectionState {
  status: SpellingCoachRuntimeSectionStatus;
  text: string;
  timingMs: number;
  error: {
    code: string;
    message: string;
  } | null;
}

export type SpellingCoachRuntimeSections = Record<
  SpellingCoachStreamSection,
  SpellingCoachRuntimeSectionState
>;

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
    primaryErrorType: string | null;
    secondaryErrorTypes: string[];
    errorTypeEvidence: Record<string, string>;
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
      morphemeGlosses?: MorphemeGloss[];
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
  streamSections?: SpellingCoachRuntimeSections;
}

export interface SpellingCoachStreamMeta {
  requestId: string;
  isCorrect: boolean;
  timingMs: number;
  targetWordMasked: boolean;
  missAnalysis?: CoachingResponse["missAnalysis"];
}

export interface SpellingCoachStreamError {
  section: SpellingCoachStreamSection;
  error: {
    code: string;
    message: string;
  };
  timingMs: number;
}

export interface SpellingCoachSectionEvent {
  section: SpellingCoachStreamSection;
  timingMs: number;
}

export interface SpellingCoachSectionChunkEvent extends SpellingCoachSectionEvent {
  text: string;
}

export interface SpellingCoachStreamDone {
  complete: true;
  timings: {
    metaMs: number;
    precomputedMs: number;
    runtimeCoachingMs: number;
    totalMs: number;
  };
}

export interface SpellingCoachStreamHandlers {
  signal?: AbortSignal;
  onMeta?: (meta: SpellingCoachStreamMeta, result: CoachingResponse) => void;
  onPrecomputed?: (result: CoachingResponse) => void;
  onSectionStart?: (
    event: SpellingCoachSectionEvent,
    result: CoachingResponse,
  ) => void;
  onSectionChunk?: (
    event: SpellingCoachSectionChunkEvent,
    result: CoachingResponse,
  ) => void;
  onSectionComplete?: (
    event: SpellingCoachSectionEvent,
    result: CoachingResponse,
  ) => void;
  onSection?: (
    section: SpellingCoachStreamSection,
    result: CoachingResponse,
  ) => void;
  onSectionError?: (error: SpellingCoachStreamError) => void;
  onDone?: (result: CoachingResponse, done: SpellingCoachStreamDone) => void;
}

export interface PracticeSessionRecord {
  id: string;
  user_id?: string;
  mode: string;
  status?: "active" | "completed" | "abandoned";
  origin_language?: string | null;
  custom_list_id?: string | null;
  custom_list_name?: string | null;
  session_started_at: string;
  session_ended_at: string | null;
  total_words_attempted?: number;
  total_correct?: number;
  duration_seconds?: number | null;
  created_at?: string;
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
  coaching_response?: Record<string, unknown> | string | null;
  created_at: string;
  word_catalog_entry?: Partial<WordData> | null;
}

export type StartPracticeSessionResult =
  | { action: "created"; sessionId: string }
  | { action: "resume_existing"; sessionId: string }
  | {
    action: "active_session_conflict";
    activeSessionId: string;
    activeMode: string;
  };

export interface StartPracticeSessionRequest {
  mode: string;
  level?: number;
  originLanguage?: string;
  customListId?: string;
  customListName?: string;
  forceCloseCurrent?: boolean;
}

export interface RecordAttemptBody {
  sessionId: string;
  targetWord: string;
  childAttempt: string;
  isCorrect: boolean;
  level: number;
  mode: string;
  definitionViewed: boolean;
  exampleViewed: boolean;
  originViewed: boolean;
  partOfSpeechViewed: boolean;
  repeatWordCount: number;
  usedVoiceInput: boolean;
  coachingResponse: string;
}

export interface EndSessionBody {
  sessionId: string;
  totalWordsAttempted: number;
  totalCorrect: number;
  durationSeconds: number;
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
}

export interface FileImportStartResponse {
  status: "processing_in_background";
  jobId: string;
  listId?: string;
  listName: string;
  detectedWords: number;
  filename: string;
}

export type FileImportJobResponse =
  | { status: "processing"; filename: string; detectedWords: number; startedAt: number }
  | { status: "done"; result: ImportCustomListResponse; completedAt: number }
  | { status: "failed"; error: string; completedAt: number };

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
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      return mockNextWord(opts);
    }
    throw err;
  }
}

export async function startPracticeSession(
  body: StartPracticeSessionRequest,
): Promise<StartPracticeSessionResult> {
  const res = await fetch(`${BASE_URL}/api/sessions/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to start practice session");
  return res.json();
}

export async function fetchSessionAttempts(sessionId: string): Promise<DbWordAttempt[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/sessions/attempts?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: await authHeaders() },
    );
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to fetch session attempts");
    const data = await res.json();
    return data.attempts;
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      return [];
    }
    throw err;
  }
}

export async function fetchPracticeSession(
  sessionId: string,
): Promise<PracticeSessionRecord | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/sessions/current?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: await authHeaders() },
    );
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to refresh practice session");
    const data = await res.json();
    return data.session;
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      return null;
    }
    throw err;
  }
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

export async function endPracticeSession(
  body: EndSessionBody,
  keepalive = false,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/sessions/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
    keepalive,
  });
  if (res.status === 401) await handle401();
  if (!res.ok) throw new Error("Failed to end practice session");
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
    if (res.status === 401) throw new UnauthorizedError();
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
  if (res.status === 401) throw new UnauthorizedError();
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
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error("Failed to import custom list");
  invalidateCustomListsCache();
  return res.json();
}

async function responseError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => null) as { error?: unknown } | null;
  return new Error(typeof data?.error === "string" && data.error.trim() ? data.error : fallback);
}

export async function importCustomWordFile(
  file: File,
  options: { pollIntervalMs?: number; maxPolls?: number; signal?: AbortSignal } = {},
): Promise<ImportCustomListResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const upload = await fetch(`${BASE_URL}/api/words/import-file`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
    signal: options.signal,
  });
  if (upload.status === 401) throw new UnauthorizedError();
  if (!upload.ok) throw await responseError(upload, "File import could not be started.");

  const started = await upload.json() as FileImportStartResponse;
  if (!started.jobId) throw new Error("The server did not return an import job ID.");

  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const maxPolls = options.maxPolls ?? 240;
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    if (options.signal?.aborted) {
      throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    const status = await fetch(
      `${BASE_URL}/api/words/import-jobs/${encodeURIComponent(started.jobId)}`,
      { headers: await authHeaders(), signal: options.signal },
    );
    if (status.status === 401) throw new UnauthorizedError();
    if (!status.ok) throw await responseError(status, "Could not check the file import status.");

    const job = await status.json() as FileImportJobResponse;
    if (job.status === "done") {
      invalidateCustomListsCache();
      return job.result;
    }
    if (job.status === "failed") throw new Error(job.error || "File import failed.");

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      options.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(options.signal!.reason ?? new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  }

  throw new Error("The file import is taking longer than expected. Please try again.");
}

export async function fetchPronunciationAudio(word: string): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/words/${encodeURIComponent(word)}/pronunciation`);
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to fetch pronunciation");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) return mockPronunciationAudio(word);
    throw err;
  }
}

type ParsedSseEvent = {
  event: string;
  data: unknown;
};

const STREAM_SECTION_KEYS: SpellingCoachStreamSection[] = [
  "short_feedback",
  "miss_analysis",
  "explanation",
  "memory_tip",
];

function emptyRuntimeSections(isCorrect = false): SpellingCoachRuntimeSections {
  const status: SpellingCoachRuntimeSectionStatus = isCorrect ? "complete" : "idle";
  return STREAM_SECTION_KEYS.reduce((sections, section) => {
    sections[section] = {
      status,
      text: "",
      timingMs: 0,
      error: null,
    };
    return sections;
  }, {} as SpellingCoachRuntimeSections);
}

function emptyCoachingResponse(isCorrect: boolean): CoachingResponse {
  return {
    correctness: {
      isCorrect,
      reinforceSuccess: isCorrect,
    },
    missAnalysis: {
      summary: "",
      errorTypes: [],
      primaryErrorFocus: "",
      likelyWrongWordInterpretation: false,
      usedMeaningDisambiguationWell: false,
    },
    wordTeaching: {
      formTeaching: {
        summary: "",
        patterns: [],
        chunks: [],
        chunkReason: "",
        sayAloudFocus: "",
      },
      conceptTeaching: {
        summary: "",
        meaningFocus: "",
        originFocus: "",
        morphologyFocus: "",
        originLabels: [],
        morphologyLabels: [],
        relatedForms: [],
      },
    },
    errorRelevance: {
      mostRelevantToError: "unclear",
      confidence: 0,
      reason: "",
    },
    teachingDecision: {
      strategy: "mixed",
      primaryFocus: "",
      secondaryFocuses: [],
      confidence: 0,
      rationale: "",
    },
    coachingText: {
      shortFeedback: "",
      fullExplanation: "",
      memoryTip: "",
      sayAloudTip: "",
    },
    wordBreakdown: {
      displayChunks: [],
      chunkReason: "",
      matchedPatterns: [],
    },
    conceptLabels: {
      originLabels: [],
      patternLabels: [],
      morphologyLabels: [],
    },
    nextStep: {
      practiceFocus: "",
      shouldReviewSoon: false,
      suggestedSimilarWordTypes: [],
    },
    streamSections: emptyRuntimeSections(isCorrect),
  };
}

function parseSseBlock(block: string): ParsedSseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  return {
    event,
    data: JSON.parse(dataLines.join("\n")),
  };
}

async function consumeSseResponse(
  response: Response,
  onEvent: (event: ParsedSseEvent) => boolean,
): Promise<void> {
  if (!response.body) {
    throw new Error("Streaming response body is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalEventReceived = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        const delimiter = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
        buffer = buffer.slice(boundary + delimiter.length);
        const parsed = parseSseBlock(block);
        if (parsed && onEvent(parsed)) {
          terminalEventReceived = true;
          break;
        }
        boundary = buffer.search(/\r?\n\r?\n/);
      }

      if (terminalEventReceived) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      if (done) break;
    }

    if (!terminalEventReceived && buffer.trim()) {
      const parsed = parseSseBlock(buffer.trim());
      if (parsed) onEvent(parsed);
    }
  } finally {
    reader.releaseLock();
  }
}

function createStreamAssembler(handlers: SpellingCoachStreamHandlers) {
  let result: CoachingResponse | null = null;
  let done = false;

  const requireResult = (eventName: string): CoachingResponse => {
    if (!result) throw new Error(`Received ${eventName} before meta.`);
    if (!result.streamSections) {
      result = { ...result, streamSections: emptyRuntimeSections() };
    }
    return result;
  };

  const setSectionState = (
    section: SpellingCoachStreamSection,
    patch: Partial<SpellingCoachRuntimeSectionState>,
  ) => {
    const current = requireResult("section event");
    const previous = current.streamSections?.[section] ?? emptyRuntimeSections()[section];
    result = {
      ...current,
      streamSections: {
        ...current.streamSections!,
        [section]: {
          ...previous,
          ...patch,
        },
      },
    };
  };

  const applySectionText = (
    section: SpellingCoachStreamSection,
    text: string,
  ) => {
    const current = requireResult("section text");
    switch (section) {
      case "short_feedback":
        result = {
          ...current,
          coachingText: {
            ...current.coachingText,
            shortFeedback: text.trim(),
          },
        };
        break;
      case "miss_analysis":
        result = {
          ...current,
          missAnalysis: {
            ...current.missAnalysis,
            summary: text,
          },
        };
        break;
      case "explanation":
        result = {
          ...current,
          coachingText: {
            ...current.coachingText,
            fullExplanation: text,
            shortFeedback: current.coachingText.shortFeedback || text,
          },
        };
        break;
      case "memory_tip":
        result = {
          ...current,
          coachingText: {
            ...current.coachingText,
            memoryTip: text,
          },
        };
        break;
    }
  };

  const handleEvent = ({ event, data }: ParsedSseEvent): boolean => {
    if (event === "meta") {
      const meta = data as SpellingCoachStreamMeta;
      result = emptyCoachingResponse(meta.isCorrect);
      if (meta.missAnalysis) {
        result = {
          ...result,
          missAnalysis: meta.missAnalysis,
        };
      }
      handlers.onMeta?.(meta, result);
      return false;
    }

    if (event === "precomputed") {
      if (!result) throw new Error("Received precomputed before meta.");
      const payload = (data as {
        payload: {
          wordTeaching?: Partial<CoachingResponse["wordTeaching"]>;
          wordBreakdown?: CoachingResponse["wordBreakdown"];
          conceptLabels?: CoachingResponse["conceptLabels"];
          sayAloudTip?: string;
        };
      }).payload;
      result = {
        ...result,
        wordTeaching: payload.wordTeaching
          ? { ...result.wordTeaching, ...payload.wordTeaching }
          : result.wordTeaching,
        wordBreakdown: payload.wordBreakdown ?? result.wordBreakdown,
        conceptLabels: payload.conceptLabels ?? result.conceptLabels,
        coachingText: {
          ...result.coachingText,
          sayAloudTip: payload.sayAloudTip?.trim() || result.coachingText.sayAloudTip,
        },
      };
      handlers.onPrecomputed?.(result);
      return false;
    }

    if (event === "section-start") {
      const sectionEvent = data as SpellingCoachSectionEvent;
      setSectionState(sectionEvent.section, {
        status: "streaming",
        timingMs: sectionEvent.timingMs,
        error: null,
      });
      handlers.onSectionStart?.(sectionEvent, result!);
      handlers.onSection?.(sectionEvent.section, result!);
      return false;
    }

    if (event === "section-chunk") {
      const chunkEvent = data as SpellingCoachSectionChunkEvent;
      const current = requireResult("section-chunk");
      const previousText =
        current.streamSections?.[chunkEvent.section]?.text ?? "";
      const nextText = previousText + chunkEvent.text;
      setSectionState(chunkEvent.section, {
        status: "streaming",
        text: nextText,
        timingMs: chunkEvent.timingMs,
        error: null,
      });
      applySectionText(chunkEvent.section, nextText);
      handlers.onSectionChunk?.(chunkEvent, result!);
      handlers.onSection?.(chunkEvent.section, result!);
      return false;
    }

    if (event === "section-complete") {
      const sectionEvent = data as SpellingCoachSectionEvent;
      const current = requireResult("section-complete");
      setSectionState(sectionEvent.section, {
        status:
          current.streamSections?.[sectionEvent.section]?.status === "error"
            ? "error"
            : "complete",
        timingMs: sectionEvent.timingMs,
      });
      handlers.onSectionComplete?.(sectionEvent, result!);
      handlers.onSection?.(sectionEvent.section, result!);
      return false;
    }

    if (event === "section") {
      if (!result) throw new Error("Received section before meta.");
      const sectionEvent = data as {
        section: SpellingCoachStreamSection;
        payload: Record<string, unknown>;
        timingMs?: number;
      };
      switch (sectionEvent.section) {
        case "short_feedback": {
          const payload = sectionEvent.payload as { shortFeedback?: string };
          result = {
            ...result,
            coachingText: {
              ...result.coachingText,
              shortFeedback: payload.shortFeedback ?? result.coachingText.shortFeedback,
            },
          };
          setSectionState(sectionEvent.section, {
            status: "complete",
            text: result.coachingText.shortFeedback,
            timingMs: sectionEvent.timingMs ?? 0,
          });
          break;
        }
        case "miss_analysis": {
          const payload = sectionEvent.payload as {
            missAnalysis?: CoachingResponse["missAnalysis"];
            errorRelevance?: CoachingResponse["errorRelevance"];
            teachingDecision?: CoachingResponse["teachingDecision"];
          };
          result = {
            ...result,
            missAnalysis: payload.missAnalysis ?? result.missAnalysis,
            errorRelevance: payload.errorRelevance ?? result.errorRelevance,
            teachingDecision:
              payload.teachingDecision ?? result.teachingDecision,
          };
          setSectionState(sectionEvent.section, {
            status: "complete",
            text: result.missAnalysis.summary,
            timingMs: sectionEvent.timingMs ?? 0,
          });
          break;
        }
        case "explanation": {
          const payload = sectionEvent.payload as {
            shortFeedback?: string;
            fullExplanation?: string;
            sayAloudTip?: string;
          };
          result = {
            ...result,
            coachingText: {
              ...result.coachingText,
              shortFeedback:
                payload.shortFeedback ?? result.coachingText.shortFeedback,
              fullExplanation:
                payload.fullExplanation ?? result.coachingText.fullExplanation,
              sayAloudTip:
                payload.sayAloudTip ?? result.coachingText.sayAloudTip,
            },
          };
          setSectionState(sectionEvent.section, {
            status: "complete",
            text: result.coachingText.fullExplanation,
            timingMs: sectionEvent.timingMs ?? 0,
          });
          break;
        }
        case "memory_tip": {
          const payload = sectionEvent.payload as { memoryTip?: string };
          result = {
            ...result,
            coachingText: {
              ...result.coachingText,
              memoryTip: payload.memoryTip ?? result.coachingText.memoryTip,
            },
          };
          setSectionState(sectionEvent.section, {
            status: "complete",
            text: result.coachingText.memoryTip,
            timingMs: sectionEvent.timingMs ?? 0,
          });
          break;
        }
      }
      handlers.onSection?.(sectionEvent.section, result);
      return false;
    }

    if (event === "section-error") {
      const errorEvent = data as SpellingCoachStreamError;
      setSectionState(errorEvent.section, {
        status: "error",
        timingMs: errorEvent.timingMs,
        error: errorEvent.error,
      });
      handlers.onSectionError?.(errorEvent);
      if (result) handlers.onSection?.(errorEvent.section, result);
      return false;
    }

    if (event === "done") {
      if (!result) throw new Error("Received done before meta.");
      done = true;
      if (result.streamSections) {
        for (const key of STREAM_SECTION_KEYS) {
          const sec = result.streamSections[key];
          if (sec && (sec.status === "idle" || sec.status === "streaming")) {
            setSectionState(key, {
              status: "complete",
            });
          }
        }
      }
      handlers.onDone?.(result, data as SpellingCoachStreamDone);
      return true;
    }
    return false;
  };

  return {
    handleEvent,
    finish(): CoachingResponse {
      if (!done || !result) {
        throw new Error("Spelling coach stream ended before done.");
      }
      return result;
    },
  };
}

export async function submitSpellingAttempt(
  body: CoachingRequest,
  handlers: SpellingCoachStreamHandlers = {},
): Promise<CoachingResponse> {
  const assembler = createStreamAssembler(handlers);
  const res = await fetch(`${BASE_URL}/api/spelling-coach/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to submit attempt");
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/event-stream")) {
    throw new Error("Expected a text/event-stream response.");
  }
  await consumeSseResponse(res, assembler.handleEvent);
  return assembler.finish();
}

export interface PersistedAttemptResult {
  attemptId: string;
  session: PracticeSessionRecord | null;
  sessionRefreshError?: Error;
}

export interface SubmitAndRecordResult {
  coaching: CoachingResponse;
  persistence: Promise<PersistedAttemptResult>;
}

export interface SubmitAndRecordOptions {
  waitForPreviousPersistence?: Promise<unknown>;
  onAttemptSaved?: (attemptId: string) => void;
}

export async function submitAndRecordSpellingAttempt(
  coachingRequest: CoachingRequest,
  attempt: Omit<RecordAttemptBody, "isCorrect" | "coachingResponse">,
  handlers: SpellingCoachStreamHandlers = {},
  options: SubmitAndRecordOptions = {},
): Promise<SubmitAndRecordResult> {
  let meta: SpellingCoachStreamMeta | undefined;
  let done: SpellingCoachStreamDone | undefined;

  const coaching = await submitSpellingAttempt(coachingRequest, {
    ...handlers,
    onMeta: (event, partial) => {
      meta = event;
      handlers.onMeta?.(event, partial);
    },
    onDone: (finalResult, event) => {
      done = event;
      handlers.onDone?.(finalResult, event);
    },
  });

  const coachingResponse = JSON.stringify({
    ...coaching,
    streamMetadata: { meta, done },
  });
  const persist = async (): Promise<PersistedAttemptResult> => {
    await options.waitForPreviousPersistence;
    const attemptId = await recordWordAttempt({
      ...attempt,
      isCorrect: coaching.correctness.isCorrect,
      coachingResponse,
    });
    options.onAttemptSaved?.(attemptId);
    let session: PracticeSessionRecord | null = null;
    let sessionRefreshError: Error | undefined;
    try {
      session = await fetchPracticeSession(attempt.sessionId);
    } catch (error) {
      sessionRefreshError =
        error instanceof Error ? error : new Error("Failed to refresh practice session");
    }
    return { attemptId, session, sessionRefreshError };
  };
  const persistence = persist();

  return { coaching, persistence };
}

export interface SubscriptionStatus {
  subscribed: boolean;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  billingInterval?: string | null;
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const res = await fetch(`${BASE_URL}/api/stripe/subscription-status`, {
      headers: await authHeaders(),
    });
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to fetch subscription status");
    return res.json();
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      const isSub = localStorage.getItem("mock_subscribed") === "true";
      return { subscribed: isSub, cancelAtPeriodEnd: false };
    }
    throw err;
  }
}

export async function createStripeCheckoutSession(): Promise<{ url: string }> {
  try {
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
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      localStorage.setItem("mock_subscribed", "true");
      return { url: `${window.location.origin}/?payment_success=true` };
    }
    throw err;
  }
}

export async function createStripePortalSession(): Promise<{ url: string }> {
  try {
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
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      return { url: window.location.origin };
    }
    throw err;
  }
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
  weekly_email_enabled: boolean;
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
      weekly_email_enabled: false,
    };
    localStorage.setItem("mock_user_profile", JSON.stringify(mock));
    return mock;
  }
  const res = await fetch(`${BASE_URL}/api/users/profile`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) throw new UnauthorizedError();
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
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error("Failed to update user profile");
  const data = await res.json();
  return data.profile;
}

export interface DbUserStats {
  mode: string;
  origin_language?: string | null;
  custom_list_id?: string | null;
  current_streak: number;
  best_streak: number;
  total_attempts: number;
  correct_attempts: number;
  badges: string[];
}

export async function fetchUserStatistics(): Promise<DbUserStats[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/users/stats`, {
      headers: await authHeaders(),
    });
    if (res.status === 401) await handle401();
    if (!res.ok) throw new Error("Failed to fetch user statistics");
    const data = await res.json();
    return data.stats;
  } catch (err) {
    if (USE_MOCK_FALLBACK && err instanceof TypeError) {
      return [];
    }
    throw err;
  }
}

export type ReportDateRange = "7d" | "30d" | "90d" | "all";

export type ReportSectionResponse<Section extends ReportSection> =
  Pick<ReportsMock, Section> & { pagination?: ReportPagination };

export async function fetchReports<Section extends ReportSection>(
  range: ReportDateRange,
  section: Section,
  page = 1,
): Promise<ReportSectionResponse<Section>> {
  const params = new URLSearchParams({
    range,
    section,
    page: String(page),
    pageSize: "10",
    locale: navigator.language || "en-US",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const res = await fetch(`${BASE_URL}/api/reports?${params}`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error("Failed to fetch report data");
  return res.json();
}

// ---------- Word search + word detail ----------

export type WordSearchMode = "startsWith" | "contains";

export interface WordSearchResult {
  word: string;
  level: string;
  origin: string;
  partOfSpeech: string;
}

export interface WordSearchResponse {
  query: string;
  mode: WordSearchMode;
  limit: number;
  count: number;
  results: WordSearchResult[];
}

export interface WordDetailPhonemeMetadata {
  source?: string;
  phonemes?: string[];
  soundAwarePatterns?: { label: string }[];
  silentLetters?: { text: string; reason?: string }[];
  trickyParts?: {
    text: string;
    label?: string;
    reason?: string;
    source?: string;
    sounds_like?: string;
  }[];
  friendlyChunks?: string[];
  sayAloudTip?: string;
  pronunciationConfidence?: string;
}

export interface WordDetail {
  word: string;
  level: string;
  gradeBand?: string;
  difficulty?: string;
  origin: string;
  definition: string;
  exampleSentence: string;
  partOfSpeech: string;
  wordBreakdown?: {
    displayChunks: string[];
    alternateDisplayChunks?: string[];
    chunkReason?: string;
    matchedPatterns?: { label: string; matchedText?: string; matchedParts?: string[] }[];
  };
  conceptLabels?: {
    originLabels: string[];
    patternLabels: string[];
    morphologyLabels: string[];
  };
  wordTeaching?: {
    conceptTeaching?: {
      summary?: string;
      meaningFocus?: string;
      originFocus?: string;
      morphologyFocus?: string;
      originLabels?: string[];
      morphologyLabels?: string[];
      relatedForms?: string[];
      morphemeGlosses?: MorphemeGloss[];
    };
  };
  phonemeMetadata?: WordDetailPhonemeMetadata;
}

export async function searchWords(
  query: string,
  mode: WordSearchMode = "startsWith",
  limit = 10,
): Promise<WordSearchResponse> {
  const params = new URLSearchParams({ q: query, mode });
  if (limit) params.set("limit", String(limit));
  const res = await fetch(`${BASE_URL}/api/words/search?${params}`);
  if (!res.ok) throw new Error("Failed to search words");
  return res.json();
}

export async function fetchReportSessionDetails(
  sessionId: string,
): Promise<ReportSessionWord[]> {
  const params = new URLSearchParams({ sessionId });
  const res = await fetch(`${BASE_URL}/api/reports/session-details?${params}`, {
    headers: await authHeaders(),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error("Failed to fetch session details");
  const data = await res.json();
  return data.words;
}

export async function fetchWordDetail(word: string): Promise<WordDetail> {
  const res = await fetch(`${BASE_URL}/api/words/${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error("Failed to fetch word detail");
  return res.json();
}
