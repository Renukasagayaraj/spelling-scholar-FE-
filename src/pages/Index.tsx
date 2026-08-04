import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Send, ArrowRight, Volume2, Volume1, VolumeX, Sparkles, Play, StopCircle } from "lucide-react";
import { downloadSessionReport } from "@/lib/sessionReport";
import confetti from "canvas-confetti";
import { useCheer } from "@/hooks/use-cheer";
import { LevelSelector } from "@/components/LevelSelector";
import { SupportCard } from "@/components/SupportCard";
import { CoachingResult } from "@/components/CoachingResult";
import { DebugPanel } from "@/components/DebugPanel";
import { type ThemeKey } from "@/components/ThemePicker";
import { type PracticeMode } from "@/components/PracticeModeSwitch";
import { CustomListPanel } from "@/components/CustomListPanel";
import { ForeignOriginPanel } from "@/components/ForeignOriginPanel";
import { ChannelsDashboard, type ChannelSelection } from "@/components/ChannelsDashboard";
import { RewardsStrip } from "@/components/RewardsStrip";
import { LevelUpFlash } from "@/components/LevelUpFlash";
import { WordSearchSidebar } from "@/components/WordSearchSidebar";
import { DinoDecor } from "@/components/DinoDecor";
import { useRewards } from "@/hooks/use-rewards";
import { ArrowLeft, GraduationCap, List as ListIcon, Globe } from "lucide-react";
import {
  fetchNextWord,
  submitSpellingAttempt,
  submitAndRecordSpellingAttempt,
  fetchPronunciationAudio,
  startPracticeSession,
  recordWordAttempt,
  endPracticeSession,
  fetchUserStatistics,
  fetchSessionAttempts,
  fetchPracticeSession,
  fetchCustomLists,
  fetchForeignOriginDetails,
} from "@/lib/api";
import { endMockBeeSession } from "@/lib/mockBeeApi";
import { VoiceMic } from "@/components/VoiceMic";
import type { VoiceRespondResult } from "@/lib/voiceApi";
import type {
  WordData,
  CoachingResponse,
  SupportsUsed,
  SessionContext,
  CustomListSummary,
  ForeignOriginSummary,
  ForeignOriginDetail,
  NextWordParams,
  DbWordAttempt,
  PracticeSessionRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { AuthMenu } from "@/components/AuthMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type HistoryEntry } from "@/components/SessionHistoryPanel";
import { SessionHistorySidebar } from "@/components/SessionHistorySidebar";
import beePng from "@/assets/bee.png";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/use-auth";
import { PaymentDialog } from "@/components/PaymentDialog";
import { AuthDialog } from "@/components/AuthDialog";
import { ActiveSessionConflictDialog } from "@/components/ActiveSessionConflictDialog";
import { queueMockBeeResume, takePracticeResumeMode } from "@/lib/sessionResume";

const STANDARD_FREE_WORD_LIMIT = 30;

interface ActivePracticeSession {
  id: string;
  modeKey: string;
  startedAt: number;
  totalAttempts: number;
  totalCorrect: number;
}

function parseStoredCoaching(attempt: DbWordAttempt): CoachingResponse {
  let shortFeedback = attempt.coaching_response?.trim() ?? "";
  if (attempt.coaching_response) {
    try {
      const parsed = JSON.parse(attempt.coaching_response) as unknown;
      if (typeof parsed === "string") {
        shortFeedback = parsed.trim();
      } else {
        const coaching = parsed as CoachingResponse;
        if (coaching?.correctness && coaching?.coachingText && coaching?.wordTeaching) {
          return coaching;
        }
      }
    } catch {
      // Legacy attempts stored short feedback as plain text rather than JSON.
    }
  }

  return {
    correctness: { isCorrect: attempt.is_correct, reinforceSuccess: true },
    missAnalysis: {
      summary: "",
      primaryErrorType: null,
      secondaryErrorTypes: [],
      errorTypeEvidence: {},
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
      },
    },
    errorRelevance: { mostRelevantToError: "", confidence: 0, reason: "" },
    teachingDecision: {
      strategy: "",
      primaryFocus: "",
      secondaryFocuses: [],
      confidence: 0,
      rationale: "",
    },
    coachingText: {
      shortFeedback,
      fullExplanation: "",
      memoryTip: "",
      sayAloudTip: "",
    },
    wordBreakdown: { displayChunks: [], chunkReason: "", matchedPatterns: [] },
    conceptLabels: { originLabels: [], patternLabels: [], morphologyLabels: [] },
    nextStep: {
      practiceFocus: "",
      shouldReviewSoon: !attempt.is_correct,
      suggestedSimilarWordTypes: [],
    },
  };
}

function historyEntryFromAttempt(attempt: DbWordAttempt): HistoryEntry | null {
  const result = parseStoredCoaching(attempt);
  const catalog = attempt.word_catalog_entry;
  return {
    word: {
      word: attempt.target_word,
      level: catalog?.level ?? String(attempt.level ?? 1),
      gradeBand: catalog?.gradeBand ?? "",
      difficulty: catalog?.difficulty ?? "medium",
      origin: catalog?.origin ?? "",
      definition: catalog?.definition ?? "",
      exampleSentence: catalog?.exampleSentence ?? "",
      partOfSpeech: catalog?.partOfSpeech ?? "",
      pronunciation: catalog?.pronunciation ?? "",
      patterns: catalog?.patterns ?? [],
    },
    attempt: attempt.child_attempt,
    result,
  };
}

function nextWordRequestKey(params: NextWordParams): string {
  return JSON.stringify({
    level: params.level,
    customListId: params.customListId,
    foreignOrigin: params.foreignOrigin,
    exclude: [...new Set(params.exclude ?? [])].sort(),
  });
}

const getParamsFromMode = (mode: string): NextWordParams => {
  if (mode.startsWith("standard_level_")) {
    const lvl = parseInt(mode.replace("standard_level_", ""), 10);
    return { level: lvl };
  }
  if (mode.startsWith("custom_list_")) {
    const listId = mode.replace("custom_list_", "");
    return { customListId: listId };
  }
  if (mode.startsWith("foreign_origin_")) {
    const origin = mode.replace("foreign_origin_", "");
    return { foreignOrigin: origin };
  }
  return {};
};

export default function Index() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeKey>("default");
  const { soundEnabled, toggleSound, playCheer } = useCheer();
  const rewards = useRewards();
  const { user, subscribed, profile, updateProfile, loading: authLoading } = useAuth();
  const prevUserId = useRef<string | undefined>(undefined);
  const hasInitializedRef = useRef(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [standardWordsUsed, setStandardWordsUsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [word, setWord] = useState<WordData | null>(null);
  const [attempt, setAttempt] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [persistingAttempt, setPersistingAttempt] = useState(false);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachingResponse | null>(null);
  const [streamErrors, setStreamErrors] = useState<string[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [defOpen, setDefOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [origOpen, setOrigOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);

  const supportsViewed = useRef<SupportsUsed>({
    definitionViewed: false,
    exampleViewed: false,
    originViewed: false,
    partOfSpeechViewed: false,
  });
  const repeatWordCount = useRef(0);
  const usedVoiceInputRef = useRef(false);
  const usedVoiceInput = usedVoiceInputRef;
  const submitAbortRef = useRef<AbortController | null>(null);
  const submitInFlightRef = useRef(false);
  const submitTaskRef = useRef<Promise<void> | null>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const persistenceFailureRef = useRef<Error | null>(null);
  const attemptPersistenceStartedRef = useRef(false);
  const attemptSavePendingRef = useRef(false);
  const sessionStartInFlightRef = useRef(false);
  const endingSessionRef = useRef<Promise<void> | null>(null);
  const pageExitEndStartedRef = useRef(false);
  const wordStateVersionRef = useRef(0);
  const prefetchedWordRef = useRef<{
    key: string;
    promise: Promise<WordData>;
  } | null>(null);

  const [session, setSession] = useState<SessionContext>({
    mode: "practice",
    previousAttemptsOnThisWord: 0,
    previousMissPatterns: [],
    recentlyPracticedWords: [],
  });

  // Channel / mode state. activeChannel = null means show the dashboard.
  const [activeChannel, setActiveChannel] = useState<PracticeMode | null>(null);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("standard");
  const [selectedCustomList, setSelectedCustomList] = useState<CustomListSummary | null>(null);
  const [customPracticeActive, setCustomPracticeActive] = useState(false);

  // Foreign origin state
  const [selectedForeignOrigin, setSelectedForeignOrigin] = useState<ForeignOriginSummary | null>(null);
  const [selectedForeignOriginDetails, setSelectedForeignOriginDetails] = useState<ForeignOriginDetail | null>(null);
  const [foreignPracticeActive, setForeignPracticeActive] = useState(false);

  // Standard practice session (start/stop with report)
  const [standardSessionActive, setStandardSessionActive] = useState(false);

  // Session word history (per practice session)
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number | null>(null);
  const [activePracticeSession, setActivePracticeSession] =
    useState<ActivePracticeSession | null>(null);
  const activePracticeSessionRef = useRef<ActivePracticeSession | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionMode, setActiveSessionMode] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionWordCount, setSessionWordCount] = useState(0);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(true);
  const [pendingConflict, setPendingConflict] = useState<{
    activeMode: string;
    activeSessionId: string;
    requestedMode: string;
  } | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const endSession = async () => {
    if (!activeSessionId || !sessionStartTime) return;
    const savedMap = localStorage.getItem("active_sessions_map");
    const map = savedMap ? JSON.parse(savedMap) : {};
    const prevAcc = (activeSessionMode && map[activeSessionMode]?.accumulatedDuration) || 0;
    const currentDuration = Math.round((Date.now() - sessionStartTime) / 1000);
    const totalDuration = prevAcc + currentDuration;

    try {
      await endPracticeSession({
        sessionId: activeSessionId,
        totalWordsAttempted: Math.max(sessionWordCount, history.length),
        totalCorrect: Math.max(sessionCorrectCount, history.filter((h) => h.result?.correctness?.isCorrect).length),
        durationSeconds: totalDuration,
      });
    } catch (err) {
      console.error("Failed to end practice session:", err);
    } finally {
      if (activeSessionMode) {
        const savedMap = localStorage.getItem("active_sessions_map");
        const map = savedMap ? JSON.parse(savedMap) : {};
        delete map[activeSessionMode];
        localStorage.setItem("active_sessions_map", JSON.stringify(map));
      }
      setActiveSessionId(null);
      setSessionStartTime(null);
      setActiveSessionMode(null);
    }
  };

  // Handle window/tab unload (pagehide) beacon flush for active practice session
  useEffect(() => {
    const handlePageHide = () => {
      if (!activeSessionId || !sessionStartTime) return;
      const savedMap = localStorage.getItem("active_sessions_map");
      const map = savedMap ? JSON.parse(savedMap) : {};
      const prevAcc = (activeSessionMode && map[activeSessionMode]?.accumulatedDuration) || 0;
      const currentDuration = Math.round((Date.now() - sessionStartTime) / 1000);
      const totalDuration = prevAcc + currentDuration;

      const totalWordsAttempted = history.length;
      const totalCorrect = history.filter((h) => h.result?.correctness?.isCorrect).length;

      void endPracticeSession(
        {
          sessionId: activeSessionId,
          totalWordsAttempted,
          totalCorrect,
          durationSeconds: totalDuration,
        },
        true,
      );
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [activeSessionId, activeSessionMode, sessionStartTime, history]);

  const clearRecoveredSessionState = useCallback((message?: string) => {
    localStorage.removeItem("active_sessions_map");
    localStorage.removeItem("active_session_recovery");
    localStorage.removeItem("active_session_history");
    localStorage.removeItem("active_session_history_index");

    setActiveSessionId(null);
    setActiveSessionMode(null);
    setSessionStartTime(null);
    setSessionWordCount(0);
    setSessionCorrectCount(0);
    setActiveChannel(null);
    setLevel(0);
    setWord(null);
    setResult(null);
    setHistory([]);
    setActiveHistoryIndex(null);
    setCustomPracticeActive(false);
    setSelectedCustomList(null);
    setForeignPracticeActive(false);
    setSelectedForeignOrigin(null);
    setSelectedForeignOriginDetails(null);
    setAttempt("");
    setDefOpen(false);
    setExOpen(false);
    setOrigOpen(false);
    setPosOpen(false);
    if (message) {
      setError(message);
    }
  }, []);

  const getRecoveredModeFromSession = useCallback(
    (session: PracticeSessionRecord, fallbackMode?: string | null) => {
      if (session.mode === "foreign_origin" && session.origin_language) {
        return `foreign_origin_${session.origin_language}`;
      }

      if (session.mode === "custom" && session.custom_list_id) {
        return `custom_list_${session.custom_list_id}`;
      }

      return fallbackMode || session.mode;
    },
    [],
  );

  const ensureSessionIsStillActive = useCallback(async () => {
    if (!activeSessionId) return true;

    try {
      const session = await fetchPracticeSession(activeSessionId);
      if (session?.status === "active") {
        return true;
      }
    } catch (err) {
      console.error("Failed to verify session status:", err);
      setError("Could not verify the current session. Please refresh and try again.");
      return false;
    }

    clearRecoveredSessionState("This session was closed in another tab.");
    return false;
  }, [activeSessionId, clearRecoveredSessionState]);

  const isStartingSession = useRef(false);

  const buildSessionRequest = (mode: string, forceCloseCurrent = false) => {
    if (mode.startsWith("standard_level_")) {
      return {
        mode: "standard",
        level: Number(mode.replace("standard_level_", "")),
        forceCloseCurrent,
      };
    }

    if (mode.startsWith("custom_list_")) {
      const customListId = mode.replace("custom_list_", "");
      return {
        mode: "custom",
        customListId,
        customListName: selectedCustomList?.name,
        forceCloseCurrent,
      };
    }

    if (mode.startsWith("foreign_origin_")) {
      return {
        mode: "foreign_origin",
        originLanguage: mode.replace("foreign_origin_", ""),
        forceCloseCurrent,
      };
    }

    return {
      mode,
      forceCloseCurrent,
    };
  };

  const prepareUiForMode = useCallback(
    async (mode: string) => {
      resetWordState();
      setError(null);

      if (mode.startsWith("standard_level_")) {
        const lvl = Number(mode.replace("standard_level_", ""));
        setPracticeMode("standard");
        setActiveChannel("standard");
        setCustomPracticeActive(false);
        setForeignPracticeActive(false);
        setSelectedCustomList(null);
        setSelectedForeignOrigin(null);
        setSelectedForeignOriginDetails(null);
        setLevel(Number.isNaN(lvl) ? 0 : lvl);
        return;
      }

      if (mode.startsWith("custom_list_")) {
        const listId = mode.replace("custom_list_", "");
        setPracticeMode("custom");
        setActiveChannel("custom");
        setCustomPracticeActive(true);
        setForeignPracticeActive(false);
        setSelectedForeignOrigin(null);
        setSelectedForeignOriginDetails(null);

        try {
          const { lists } = await fetchCustomLists();
          const matchedList = lists.find((list) => list.id === listId) ?? null;
          setSelectedCustomList(matchedList);
        } catch (err) {
          console.error("Failed to prepare custom practice mode:", err);
          setSelectedCustomList(null);
        }
        return;
      }

      if (mode.startsWith("foreign_origin_")) {
        const origin = mode.replace("foreign_origin_", "");
        setPracticeMode("foreignOrigin");
        setActiveChannel("foreignOrigin");
        setForeignPracticeActive(true);
        setCustomPracticeActive(false);
        setSelectedCustomList(null);

        try {
          const details = await fetchForeignOriginDetails(origin);
          setSelectedForeignOrigin({
            origin: details.origin,
            wordCount: details.wordCount,
          });
          setSelectedForeignOriginDetails(details);
        } catch (err) {
          console.error("Failed to prepare foreign origin mode:", err);
          setSelectedForeignOrigin({
            origin,
            wordCount: 0,
          });
          setSelectedForeignOriginDetails(null);
        }
      }
    },
    [],
  );

  const startSession = async (
    mode: string,
    options?: { forceCloseCurrent?: boolean },
  ): Promise<boolean> => {
    if (isStartingSession.current) return false;
    if (activeSessionId && activeSessionMode === mode) {
      if (!word && !loading) {
        loadWord(getParamsFromMode(mode));
      }
      return true;
    }

    isStartingSession.current = true;

    try {
      // Save current UI session state locally before switching modes.
      if (activeSessionId && activeSessionMode) {
        const savedMap = localStorage.getItem("active_sessions_map");
        const map = savedMap ? JSON.parse(savedMap) : {};
        const currentDuration = Math.round((Date.now() - (sessionStartTime || Date.now())) / 1000);
        const prevAcc = map[activeSessionMode]?.accumulatedDuration || 0;
        const totalDuration = prevAcc + currentDuration;

        map[activeSessionMode] = {
          activeSessionId,
          sessionStartTime,
          sessionWordCount,
          sessionCorrectCount,
          history,
          activeHistoryIndex,
          accumulatedDuration: totalDuration,
        };

        localStorage.setItem("active_sessions_map", JSON.stringify(map));
      }

      const result = await startPracticeSession(
        buildSessionRequest(mode, options?.forceCloseCurrent ?? false),
      );


      if (result.action === "active_session_conflict") {
        setError("Could not close the previous practice session.");
        setConflictError(null);
        setPendingConflict({
          activeMode: result.activeMode,
          activeSessionId: result.activeSessionId,
          requestedMode: mode,
        });
        setStandardSessionActive(false);
        return false;
      }

      const id = result.sessionId;
      setActiveSessionId(id);
      setActiveSessionMode(mode);
      setSessionStartTime(Date.now());

      const attempts = await fetchSessionAttempts(id);
      if (attempts && attempts.length > 0) {
        const historyEntries = attempts.map(historyEntryFromAttempt);

        setHistory(historyEntries);
        setSessionWordCount(historyEntries.length);
        setSessionCorrectCount(
          historyEntries.filter((h) => h.result?.correctness?.isCorrect).length,
        );
        setActiveHistoryIndex(null);
        setAttempt("");
        setResult(null);
        loadWord(getParamsFromMode(mode));
      } else {
        setSessionWordCount(0);
        setSessionCorrectCount(0);
        setHistory([]);
        setActiveHistoryIndex(null);
        resetWordState();
        loadWord(getParamsFromMode(mode));
      }
      return true;
    } catch (err) {
      console.error("Failed to start/resume practice session:", err);
      return false;
    } finally {
      isStartingSession.current = false;
    }
  };

  const resumePracticeMode = useCallback(
    async (mode: string) => {
      await prepareUiForMode(mode);
      await startSession(mode);
    },
    [prepareUiForMode],
  );

  const handleConflictResume = useCallback(async () => {
    if (!pendingConflict) return;

    setConflictLoading(true);
    setConflictError(null);

    try {
      if (pendingConflict.activeMode === "mock_bee") {
        queueMockBeeResume();
        setPendingConflict(null);
        navigate("/mock-bee");
        return;
      }

      await resumePracticeMode(pendingConflict.activeMode);
      setPendingConflict(null);
    } catch (err) {
      console.error("Failed to resume current session:", err);
      setConflictError("Could not resume the current session. Please try again.");
    } finally {
      setConflictLoading(false);
    }
  }, [navigate, pendingConflict, resumePracticeMode]);

  const handleConflictStartNew = useCallback(async () => {
    if (!pendingConflict) return;

    setConflictLoading(true);
    setConflictError(null);

    try {
      const isLocalCurrentSession =
        activeSessionId === pendingConflict.activeSessionId &&
        activeSessionMode === pendingConflict.activeMode;

      if (isLocalCurrentSession) {
        await endSession();
      } else if (pendingConflict.activeMode === "mock_bee") {
        await endMockBeeSession(pendingConflict.activeSessionId);
      }

      await prepareUiForMode(pendingConflict.requestedMode);
      const started = await startSession(pendingConflict.requestedMode, {
        forceCloseCurrent: !isLocalCurrentSession && pendingConflict.activeMode !== "mock_bee",
      });
      if (started) {
        if (pendingConflict.requestedMode.startsWith("standard_level_")) {
          setStandardSessionActive(true);
        }
        setPendingConflict(null);
      }
    } catch (err) {
      console.error("Failed to switch sessions:", err);
      setConflictError("Could not close the current session and start the new one.");
    } finally {
      setConflictLoading(false);
    }
  }, [activeSessionId, activeSessionMode, pendingConflict, prepareUiForMode]);

  const handleConflictCancel = useCallback(() => {
    setConflictError(null);

    if (
      pendingConflict &&
      activeSessionId === pendingConflict.activeSessionId &&
      activeSessionMode === pendingConflict.activeMode
    ) {
      void resumePracticeMode(pendingConflict.activeMode);
    }

    setPendingConflict(null);
  }, [activeSessionId, activeSessionMode, pendingConflict, resumePracticeMode]);

  // Recover active session on page reload/startup
  useEffect(() => {
    const saved = localStorage.getItem("active_session_recovery");
    if (saved) {
      void (async () => {
        try {
          const {
            activeSessionId: id,
            activeSessionMode: savedMode,
            sessionStartTime: start,
          } = JSON.parse(saved);

          if (id && start) {
            const session = await fetchPracticeSession(id);
            if (!session || session.status !== "active") {
              clearRecoveredSessionState("This session was closed in another tab.");
              setIsRecovering(false);
              return;
            }

            const restoredMode = getRecoveredModeFromSession(session, savedMode);
            await prepareUiForMode(restoredMode);

            setActiveSessionId(id);
            setActiveSessionMode(restoredMode || null);
            setSessionStartTime(start);
            const attempts = await fetchSessionAttempts(id);
            if (attempts && attempts.length > 0) {
              const historyEntries = attempts.map(historyEntryFromAttempt);
              setHistory(historyEntries);
              setSessionWordCount(historyEntries.length);
              setSessionCorrectCount(
                historyEntries.filter((entry) => entry.result?.correctness?.isCorrect).length,
              );
              setActiveHistoryIndex(historyEntries.length - 1);
              const lastEntry = historyEntries[historyEntries.length - 1];
              setWord(lastEntry.word);
              setAttempt(lastEntry.attempt);
              setResult(lastEntry.result);
            } else {
              setSessionWordCount(0);
              setSessionCorrectCount(0);
              setHistory([]);
              setActiveHistoryIndex(null);
              loadWord(getParamsFromMode(restoredMode));
            }
            setIsRecovering(false);
          } else {
            setIsRecovering(false);
          }
        } catch (e) {
          console.error("Failed to recover active session:", e);
          setError("Could not restore the previous session. Please start again.");
          setIsRecovering(false);
        }
      })();
    } else {
      setIsRecovering(false);
    }
  }, [clearRecoveredSessionState, getRecoveredModeFromSession, prepareUiForMode]);

  useEffect(() => {
    if (isRecovering || activeSessionId) return;
    const pendingMode = takePracticeResumeMode();
    if (!pendingMode) return;

    void (async () => {
      try {
        await resumePracticeMode(pendingMode);
      } catch (err) {
        console.error("Failed to resume redirected practice session:", err);
        setError("Could not resume the requested session.");
      }
    })();
  }, [activeSessionId, isRecovering, resumePracticeMode]);

  // Sync active session info and history to localStorage for recovery
  useEffect(() => {
    if (isRecovering) return;
    if (activeSessionId && sessionStartTime) {
      localStorage.setItem("active_session_recovery", JSON.stringify({
        activeSessionId,
        activeSessionMode,
        sessionStartTime,
        sessionWordCount,
        sessionCorrectCount,
        activeChannel,
        practiceMode,
        level,
        customPracticeActive,
        selectedCustomList,
        foreignPracticeActive,
        selectedForeignOrigin,
      }));
      localStorage.setItem("active_session_history", JSON.stringify(history));
      localStorage.setItem("active_session_history_index", JSON.stringify(activeHistoryIndex));

      if (activeSessionMode) {
        const savedMap = localStorage.getItem("active_sessions_map");
        const map = savedMap ? JSON.parse(savedMap) : {};
        const prevAcc = map[activeSessionMode]?.accumulatedDuration || 0;
        map[activeSessionMode] = {
          activeSessionId,
          sessionStartTime,
          sessionWordCount,
          sessionCorrectCount,
          history,
          activeHistoryIndex,
          accumulatedDuration: prevAcc,
        };
        localStorage.setItem("active_sessions_map", JSON.stringify(map));
      }
    } else {
      localStorage.removeItem("active_session_recovery");
      localStorage.removeItem("active_session_history");
      localStorage.removeItem("active_session_history_index");
    }
  }, [
    isRecovering,
    activeSessionId,
    activeSessionMode,
    sessionStartTime,
    sessionWordCount,
    sessionCorrectCount,
    activeChannel,
    level,
    customPracticeActive,
    selectedCustomList,
    foreignPracticeActive,
    selectedForeignOrigin,
    history,
    activeHistoryIndex,
  ]);

  // Reset active session local storage on login/logout to prevent stale state inheritance
  useEffect(() => {
    if (authLoading) return;

    if (!hasInitializedRef.current) {
      prevUserId.current = user?.id;
      hasInitializedRef.current = true;
      return;
    }

    if (prevUserId.current !== user?.id) {
      // Clear local storage
      localStorage.removeItem("active_sessions_map");
      localStorage.removeItem("active_session_recovery");
      localStorage.removeItem("active_session_history");
      localStorage.removeItem("active_session_history_index");

      // Reset React state to clean up the UI
      setActiveSessionId(null);
      setActiveSessionMode(null);
      setSessionStartTime(null);
      setSessionWordCount(0);
      setSessionCorrectCount(0);
      setActiveChannel(null);
      setLevel(0);
      setWord(null);
      setResult(null);
      setHistory([]);
      setActiveHistoryIndex(null);
      setCustomPracticeActive(false);
      setSelectedCustomList(null);
      setForeignPracticeActive(false);
      setSelectedForeignOrigin(null);
      setSelectedForeignOriginDetails(null);
      setAttempt("");
      setDefOpen(false);
      setExOpen(false);
      setOrigOpen(false);
      setPosOpen(false);
    }
    prevUserId.current = user?.id;
  }, [user?.id, authLoading]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "default" ? "" : theme);
  }, [theme]);

  // Sync theme setting from database profile when loaded
  useEffect(() => {
    if (profile?.theme_preference) {
      setTheme(profile.theme_preference as ThemeKey);
    }
  }, [profile?.theme_preference]);

  // Fetch user statistics from backend when user logs in
  useEffect(() => {
    if (user) {
      fetchUserStatistics()
        .then((stats) => {
          if (stats) {
            rewards.syncWithDatabase(stats);
            setStandardWordsUsed(
              stats
                .filter((stat) => stat.mode === "standard" || stat.mode.startsWith("standard_level_"))
                .reduce((total, stat) => total + stat.total_attempts, 0),
            );
          }
        })
        .catch((err) => {
          console.error("Failed to sync rewards statistics with backend:", err);
        });
    } else {
      setStandardWordsUsed(0);
    }
  }, [user, rewards.syncWithDatabase]);

  const handleThemeChange = async (newTheme: ThemeKey) => {
    setTheme(newTheme);
    if (user && updateProfile) {
      await updateProfile({ theme_preference: newTheme });
    }
  };

  // Reset to default if current theme isn't allowed for the active level
  useEffect(() => {
    if (theme === "dino" && level !== 1) setTheme("default");
    if (theme === "sunset-sea" && level !== 3) setTheme("default");
    if (theme === "pastel-sky" && level !== 2) setTheme("default");
    if (theme === "rainbow" && level !== 1) setTheme("default");
  }, [level, theme]);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetWordState = () => {
    wordStateVersionRef.current += 1;
    prefetchedWordRef.current = null;
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;
    setSubmitting(false);
    setWord(null);
    setResult(null);
    setStreamErrors([]);
    setAttempt("");
    setDefOpen(false);
    setExOpen(false);
    setOrigOpen(false);
    setPosOpen(false);
    setAudioError(null);
    setError(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    supportsViewed.current = {
      definitionViewed: false,
      exampleViewed: false,
      originViewed: false,
      partOfSpeechViewed: false,
    };
    repeatWordCount.current = 0;
    usedVoiceInput.current = false;
    attemptPersistenceStartedRef.current = false;
    attemptSavePendingRef.current = false;
    setSession((s) => ({ ...s, previousAttemptsOnThisWord: 0 }));
  };

  const loadWord = useCallback(async (params: NextWordParams) => {
    wordStateVersionRef.current += 1;
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;
    setSubmitting(false);
    setLoading(true);
    setError(null);
    setResult(null);
    setStreamErrors([]);
    setAttempt("");
    setDefOpen(false);
    setExOpen(false);
    setOrigOpen(false);
    setPosOpen(false);
    setAudioError(null);
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    supportsViewed.current = {
      definitionViewed: false,
      exampleViewed: false,
      originViewed: false,
      partOfSpeechViewed: false,
    };
    repeatWordCount.current = 0;
    usedVoiceInput.current = false;
    attemptPersistenceStartedRef.current = false;
    attemptSavePendingRef.current = false;
    setSession((s) => ({ ...s, previousAttemptsOnThisWord: 0 }));
    try {
      const requestKey = nextWordRequestKey(params);
      const prefetched = prefetchedWordRef.current;
      prefetchedWordRef.current = null;
      const w = await (
        prefetched?.key === requestKey
          ? prefetched.promise
          : fetchNextWord(params)
      );
      setWord(w);
    } catch {
      setError("Could not load word. Check your connection.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const prefetchNextWord = useCallback(
    (excludeWords: string[] = []) => {
      const modeKey = activeSessionMode || (practiceMode === "standard" ? `standard_level_${level}` : "");
      const params = getParamsFromMode(modeKey, excludeWords);
      const requestKey = nextWordRequestKey(params);
      if (prefetchedWordRef.current?.key === requestKey) return;
      prefetchedWordRef.current = {
        key: requestKey,
        promise: fetchNextWord(params),
      };
    },
    [activeSessionMode, practiceMode, level],
  );

  const openUpgradeFlow = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setPaymentOpen(true);
  };

  const standardLimitReached =
    practiceMode === "standard" && !subscribed && standardWordsUsed >= STANDARD_FREE_WORD_LIMIT;

  const handleLevelChange = (lvl: number) => {
    if (standardLimitReached) {
      openUpgradeFlow();
      return;
    }
    setLevel(lvl);
  };

  const handleStartStandardSession = async () => {
    if (!level) return;

    const started = await startSession(`standard_level_${level}`);

    if (started) {
      setStandardSessionActive(true);
    }
  };

  const handleStopStandardSession = async () => {
    await endSession();
    if (history.length > 0) {
      downloadSessionReport(history);
    }
    setStandardSessionActive(false);
    setHistory([]);
    setActiveHistoryIndex(null);
    resetWordState();
  };

  const handleSelectChannel = (selection: ChannelSelection) => {
    resetWordState();
    setCustomPracticeActive(false);
    setForeignPracticeActive(false);
    setStandardSessionActive(false);

    // Gate premium features
    if (selection.kind !== "standard") {
      if (!user) {
        setAuthOpen(true);
        return;
      }
      if (!subscribed) {
        setPaymentOpen(true);
        return;
      }
    }

    switch (selection.kind) {
      case "standard":
        setPracticeMode("standard");
        setActiveChannel("standard");
        if (activeSessionMode && activeSessionMode.startsWith("standard_level_")) {
          const lvl = parseInt(activeSessionMode.replace("standard_level_", ""), 10);
          if (!isNaN(lvl)) {
            setLevel(lvl);
          }
        } else {
          setLevel(0);
        }
        break;
      case "customManage":
        setPracticeMode("custom");
        setActiveChannel("custom");
        break;
      case "customList":
        setPracticeMode("custom");
        setActiveChannel("custom");
        setSelectedCustomList(selection.list);
        setCustomPracticeActive(true);
        startSession(`custom_list_${selection.list.id}`);
        break;
      case "foreignManage":
        setPracticeMode("foreignOrigin");
        setActiveChannel("foreignOrigin");
        break;
      case "foreignOrigin":
        setPracticeMode("foreignOrigin");
        setActiveChannel("foreignOrigin");
        setSelectedForeignOrigin(selection.origin);
        setForeignPracticeActive(true);
        startSession(`foreign_origin_${selection.origin.origin}`);
        break;
    }
  };

  const handleBackToDashboard = async () => {
    await endSession();
    setActiveChannel(null);
    setCustomPracticeActive(false);
    setForeignPracticeActive(false);
    setStandardSessionActive(false);
    // Keep session history across dashboard visits; clears on reload.
    setActiveHistoryIndex(null);
    resetWordState();
  };

  const handleStartCustomPractice = async () => {
    if (!selectedCustomList) return;
    setCustomPracticeActive(true);
    startSession(`custom_list_${selectedCustomList.id}`);
  };

  const handleStartForeignPractice = async () => {
    if (!selectedForeignOrigin) {
      setError("Please select an origin first.");
      return;
    }
    if (selectedForeignOrigin.wordCount === 0) {
      setError("This origin has no words available.");
      return;
    }
    setForeignPracticeActive(true);
    startSession(`foreign_origin_${selectedForeignOrigin.origin}`);
  };

  const effectiveLevel = (): number | undefined => {
    if (practiceMode === "custom" && selectedCustomList) return Number(selectedCustomList.level) || undefined;
    if (practiceMode === "foreignOrigin") return undefined;
    return level || undefined;
  };

  const performSubmit = async () => {
    const rawAttempt = attempt || inputRef.current?.value || "";
    if (!word || !rawAttempt.trim() || submitInFlightRef.current) return;
    if (standardLimitReached) {
      openUpgradeFlow();
      return;
    }
    const active = user && activeSessionId ? { id: activeSessionId, modeKey: activeSessionMode || practiceMode } : null;
    const anonymousStandardPractice = !user && practiceMode === "standard";
    if (!active && !anonymousStandardPractice) {
      setError("Start a practice session before submitting a spelling.");
      return;
    }

    submitInFlightRef.current = true;
    submitAbortRef.current?.abort();
    const controller = new AbortController();
    submitAbortRef.current = controller;
    setSubmitting(true);
    setError(null);
    setResult(null);
    setStreamErrors([]);
    const childAttempt = rawAttempt.trim().toLowerCase();
    const lvl = effectiveLevel();
    const supportSnapshot = { ...supportsViewed.current };
    const repeatCount = session.previousAttemptsOnThisWord;
    const usedVoiceInput = usedVoiceInputRef.current;
    const wordStateVersion = wordStateVersionRef.current;
    const isCurrentWord = () => wordStateVersionRef.current === wordStateVersion;
    let completedCoaching: CoachingResponse | null = null;
    let localAttemptApplied = false;
    let celebrationPlayed = false;
    const recentWordsAfterAttempt = [
      ...session.recentlyPracticedWords.slice(-9),
      word.word,
    ];

    const celebrateCorrectAnswer = () => {
      if (celebrationPlayed || !isCurrentWord()) return;
      celebrationPlayed = true;

      if (lvl !== 3) playCheer();
      if (lvl === 1) {
        const fire = (origin: { x: number; y: number }) =>
          confetti({
            particleCount: 80,
            spread: 70,
            startVelocity: 45,
            origin,
            zIndex: 9999,
            colors: ["#f59e0b", "#10b981", "#6366f1", "#ef4444", "#eab308"],
          });
        fire({ x: 0.2, y: 0.7 });
        fire({ x: 0.5, y: 0.6 });
        fire({ x: 0.8, y: 0.7 });
        setTimeout(() => fire({ x: 0.5, y: 0.5 }), 200);
      }
    };

    const applySuccessfulAttempt = (res: CoachingResponse) => {
      setHistory((h) => {
        const next = [...h, { word, attempt: childAttempt, result: res }];
        if (isCurrentWord()) setActiveHistoryIndex(next.length - 1);
        return next;
      });

      const currentActive = activePracticeSessionRef.current;
      if (active && currentActive?.id === active.id) {
        updateActivePracticeSession({
          ...currentActive,
          totalAttempts: currentActive.totalAttempts + 1,
          totalCorrect:
            currentActive.totalCorrect + (res.correctness.isCorrect ? 1 : 0),
        });
      }

      if (practiceMode === "standard" && !subscribed) {
        setStandardWordsUsed((count) => count + 1);
      }

      if (res.correctness?.isCorrect) {
        celebrateCorrectAnswer();
        rewards.recordCorrect(activeSessionMode || practiceMode, lvl);
      } else {
        rewards.recordIncorrect(activeSessionMode || practiceMode, lvl);
      }
      setSession((s) => ({
        ...s,
        previousAttemptsOnThisWord: isCurrentWord()
          ? s.previousAttemptsOnThisWord + 1
          : s.previousAttemptsOnThisWord,
        recentlyPracticedWords: recentWordsAfterAttempt,
      }));
    };

    const applySessionRefresh = (persisted: PersistedAttemptResult) => {
      const currentActive = activePracticeSessionRef.current;
      if (active && currentActive?.id === active.id && persisted.session) {
        const refreshedStartedAt = new Date(persisted.session.session_started_at).getTime();
        updateActivePracticeSession({
          ...currentActive,
          startedAt: Number.isNaN(refreshedStartedAt)
            ? currentActive.startedAt
            : refreshedStartedAt,
          totalAttempts: Math.max(
            currentActive.totalAttempts,
            persisted.session.total_words_attempted ?? 0,
          ),
          totalCorrect: Math.max(
            currentActive.totalCorrect,
            persisted.session.total_correct ?? 0,
          ),
        });
      }
      if (persisted.sessionRefreshError && isCurrentWord()) {
        console.error("Attempt saved, but session refresh failed:", persisted.sessionRefreshError);
        setError("Your attempt was saved, but session progress could not be refreshed.");
      }
    };

    const trackPersistence = (
      attemptSaved: Promise<void>,
      persistence: Promise<PersistedAttemptResult>,
    ) => {
      const attemptPersistenceTask = attemptSaved.then(
        () => {
          attemptSavePendingRef.current = false;
          persistenceFailureRef.current = null;
          setPersistenceFailed(false);
        },
        (persistenceError) => {
          const error = persistenceError instanceof Error
            ? persistenceError
            : new Error("Attempt persistence failed.");
          attemptSavePendingRef.current = false;
          persistenceFailureRef.current = error;
          console.error(error);
          setPersistingAttempt(false);
          setPersistenceFailed(true);
          setError("Coaching completed, but this attempt could not be saved. You cannot continue until it is resolved.");
        },
      );
      persistenceQueueRef.current = attemptPersistenceTask.catch((queueError) => {
        console.error("Attempt persistence queue failed:", queueError);
      });
      void persistence.then(applySessionRefresh, () => {
        // Attempt persistence failures are handled by attemptSaved above.
      });
    };

    try {
      const coachingRequest = {
        targetWord: word.word,
        childAttempt,
        level: lvl,
        mode: practiceMode,
        definitionViewed: supportSnapshot.definitionViewed,
        exampleViewed: supportSnapshot.exampleViewed,
        originViewed: supportSnapshot.originViewed,
        partOfSpeechViewed: supportSnapshot.partOfSpeechViewed ?? false,
        repeatWordCount: repeatCount,
        usedVoiceInput,
        ...(active ? { sessionId: active.id } : {}),
      };
      const streamHandlers: SpellingCoachStreamHandlers = {
        signal: controller.signal,
        onMeta: (meta, partialResult) => {
          if (!isCurrentWord()) return;
          setResult(partialResult);
          if (meta.isCorrect) celebrateCorrectAnswer();
        },
        onPrecomputed: (partialResult) => {
          if (isCurrentWord()) setResult(partialResult);
        },
        onSection: (_section, partialResult) => {
          if (isCurrentWord()) setResult(partialResult);
        },
        onSectionError: ({ section }) => {
          if (!isCurrentWord()) return;
          setStreamErrors((current) =>
            current.includes(section) ? current : [...current, section],
          );
        },
        onDone: (finalResult) => {
          completedCoaching = finalResult;
          if (active) {
            attemptPersistenceStartedRef.current = true;
            attemptSavePendingRef.current = true;
            persistenceFailureRef.current = null;
            setPersistenceFailed(false);
            setPersistingAttempt(true);
          }
          if (isCurrentWord()) {
            setResult(finalResult);
            setSubmitting(false);
          }
        },
      };
      const previousPersistence = persistenceQueueRef.current;
      let resolveAttemptSaved: (() => void) | null = null;
      let rejectAttemptSaved: ((reason?: unknown) => void) | null = null;
      const attemptSaved = active
        ? new Promise<void>((resolve, reject) => {
          resolveAttemptSaved = resolve;
          rejectAttemptSaved = reject;
        })
        : null;
      const completed = active
        ? await submitAndRecordSpellingAttempt(coachingRequest, {
          sessionId: active.id,
          targetWord: word.word,
          childAttempt,
          level: lvl,
          mode: active.modeKey,
          definitionViewed: supportSnapshot.definitionViewed,
          exampleViewed: supportSnapshot.exampleViewed,
          originViewed: supportSnapshot.originViewed,
          partOfSpeechViewed: supportSnapshot.partOfSpeechViewed ?? false,
          repeatWordCount: repeatCount,
          usedVoiceInput,
        }, streamHandlers, {
          waitForPreviousPersistence: previousPersistence,
          onAttemptSaved: () => {
            attemptSavePendingRef.current = false;
            if (completedCoaching && !localAttemptApplied) {
              localAttemptApplied = true;
              applySuccessfulAttempt(completedCoaching);
              prefetchNextWord(recentWordsAfterAttempt);
              setPersistingAttempt(false);
            }
            resolveAttemptSaved?.();
          },
        })
        : null;
      const res = completed?.coaching ?? await submitSpellingAttempt(coachingRequest, streamHandlers);
      if (completed && attemptSaved) {
        void completed.persistence.catch((persistenceError) => {
          rejectAttemptSaved?.(persistenceError);
        });
        trackPersistence(attemptSaved, completed.persistence);
      } else {
        applySuccessfulAttempt(res);
        prefetchNextWord(recentWordsAfterAttempt);
      }
    } catch (submitError) {
      if (controller.signal.aborted) return;
      console.error(submitError);
      if (isCurrentWord()) {
        setResult(completedCoaching);
        setError(
          attemptPersistenceStartedRef.current
            ? "Coaching completed, but this attempt could not be saved."
            : submitError instanceof Error
              ? submitError.message
              : "Could not submit. Please try again.",
        );
      }
    } finally {
      submitInFlightRef.current = false;
      if (submitAbortRef.current === controller) {
        submitAbortRef.current = null;
        if (isCurrentWord()) setSubmitting(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (submitTaskRef.current) return submitTaskRef.current;
    const task = performSubmit();
    submitTaskRef.current = task;
    try {
      await task;
    } finally {
      if (submitTaskRef.current === task) submitTaskRef.current = null;
    }
  };

  const handleNextWord = async () => {
    if (standardLimitReached) {
      openUpgradeFlow();
      return;
    }

    setActiveHistoryIndex(null);
    loadWord(getParamsFromMode(activeSessionMode || (practiceMode === "standard" ? `standard_level_${level}` : "")));
  };

  const playPronunciation = async () => {
    if (!word || audioLoading) return;
    setAudioLoading(true);
    setAudioError(null);
    repeatWordCount.current = repeatWordCount.current + 1;
    try {
      const url = await fetchPronunciationAudio(word.word);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      await audio.play();
    } catch {
      setAudioError("Could not play audio.");
    } finally {
      setAudioLoading(false);
    }
  };

  const toggleDef = () => {
    setDefOpen((v) => !v);
    supportsViewed.current.definitionViewed = true;
  };
  const toggleEx = () => {
    setExOpen((v) => !v);
    supportsViewed.current.exampleViewed = true;
  };
  const toggleOrig = () => {
    setOrigOpen((v) => !v);
    supportsViewed.current.originViewed = true;
  };
  const togglePos = () => {
    setPosOpen((v) => !v);
    supportsViewed.current.partOfSpeechViewed = true;
  };

  const hasWord = !!word && !loading;
  const submitted = !!result;

  const showDashboard = activeChannel === null;
  const showStandardFlow = activeChannel === "standard";
  const showCustomSetup = activeChannel === "custom" && !customPracticeActive;
  const showForeignSetup = activeChannel === "foreignOrigin" && !foreignPracticeActive;
  const showPractice =
    (showStandardFlow && standardSessionActive) ||
    (activeChannel === "custom" && customPracticeActive) ||
    (activeChannel === "foreignOrigin" && foreignPracticeActive);

  const channelLabels: Record<PracticeMode, { label: string; Icon: typeof GraduationCap }> = {
    standard: { label: "Standard Practice", Icon: GraduationCap },
    custom: { label: "My Word Lists", Icon: ListIcon },
    foreignOrigin: { label: "Language Origin", Icon: Globe },
  };

  return (
    <div className="min-h-screen">
      {theme === "dino" && <DinoDecor />}
      {showPractice && (
        <SessionHistorySidebar
          history={history}
          activeIndex={activeHistoryIndex}
          onSelect={(i) => {
            const entry = history[i];
            if (!entry) return;
            submitAbortRef.current?.abort();
            submitAbortRef.current = null;
            setSubmitting(false);
            setStreamErrors([]);
            setWord(entry.word);
            setAttempt(entry.attempt);
            setResult(entry.result);
            setActiveHistoryIndex(i);
          }}
        />
      )}
      {activeChannel && <WordSearchSidebar />}
      {/* Top app bar — webapp style */}
      <Header
        theme={theme}
        onThemeChange={handleThemeChange}
        level={showDashboard ? undefined : effectiveLevel()}
        showSound={showPractice}
        onLogoClick={handleBackToDashboard}
        maxWidthClass="max-w-6xl"
      />

      <div className={cn(
        "mx-auto px-4 sm:px-8 py-6 sm:py-10",
        showDashboard ? "max-w-6xl" : "max-w-3xl"
      )}>

        {/* Dashboard or active channel header */}
        {showDashboard ? (
          <>
            <ChannelsDashboard onSelectChannel={handleSelectChannel} />
          </>
        ) : (
          <div className="mb-6 flex items-center justify-between gap-2">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5 hover:bg-accent/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
            {activeChannel && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {(() => {
                    const { Icon, label } = channelLabels[activeChannel];
                    return (
                      <>
                        <Icon className="h-4 w-4 text-primary" />
                        {label}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom List Setup */}
        {showCustomSetup && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <CustomListPanel
              selectedList={selectedCustomList}
              onSelectList={setSelectedCustomList}
              onStartPractice={handleStartCustomPractice}
            />
          </motion.div>
        )}

        {/* Foreign Origin Setup */}
        {showForeignSetup && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <ForeignOriginPanel
              selectedOrigin={selectedForeignOrigin}
              onSelectOrigin={setSelectedForeignOrigin}
              onDetailsLoaded={setSelectedForeignOriginDetails}
              onStartPractice={handleStartForeignPractice}
            />
            {error && (
              <p className="mt-3 text-xs text-destructive text-center">{error}</p>
            )}
          </motion.div>
        )}

        {/* Active custom list banner */}
        {practiceMode === "custom" && customPracticeActive && selectedCustomList && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedCustomList.name}</p>
              <p className="text-[10px] text-muted-foreground">
                Level {selectedCustomList.level} · {selectedCustomList.wordCount} words
              </p>
            </div>
            <button
              onClick={() => void handleChangePracticeSource("custom")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Change List
            </button>
          </div>
        )}

        {/* Active foreign origin banner */}
        {practiceMode === "foreignOrigin" && foreignPracticeActive && selectedForeignOrigin && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Practicing {selectedForeignOrigin.origin} origin words
              </p>
              <p className="text-[10px] text-muted-foreground">
                {selectedForeignOrigin.wordCount} words available
              </p>
            </div>
            <button
              onClick={() => void handleChangePracticeSource("foreign")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Change Origin
            </button>
          </div>
        )}

        {/* Standard: Level Selector + Start Session (before session starts) */}
        {showStandardFlow && !standardSessionActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm p-6 sm:p-8 space-y-4 relative overflow-hidden"
          >
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary font-display">
                  Choose your level
                </span>
              </div>
            </div>
            <LevelSelector selected={level} onSelect={handleLevelChange} />
            {!subscribed && (
              <p className="text-center text-xs text-muted-foreground">
                {Math.max(0, STANDARD_FREE_WORD_LIMIT - standardWordsUsed)} of {STANDARD_FREE_WORD_LIMIT} free words remaining
              </p>
            )}
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={handleStartStandardSession}
                disabled={!level}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all"
              >
                <Play className="h-4 w-4" />
                Start Session
              </button>
              <p className="text-xs text-muted-foreground">
                {level ? "Words you practice will be included in your session report." : "Pick a level to begin your session."}
              </p>
            </div>
          </motion.div>
        )}


        {/* Active standard session banner */}
        {showStandardFlow && standardSessionActive && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Session in progress · Level {level}</p>
              <p className="text-[10px] text-muted-foreground">
                {history.length} word{history.length === 1 ? "" : "s"} practiced · Stop to download your report
              </p>
            </div>
            <button
              onClick={handleStopStandardSession}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <StopCircle className="h-3.5 w-3.5" />
              Stop Session
            </button>
          </div>
        )}


        {/* Loading */}
        {showPractice && loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center text-sm text-destructive mb-4">
            {error}
            {!persistenceFailed && (
              <button
                onClick={handleNextWord}
                className="block mx-auto mt-2 underline text-xs"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Word Practice Area */}
        {showPractice && hasWord && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm p-6 sm:p-8 space-y-3"
          >
            {/* Rewards strip — all levels */}
            <RewardsStrip
              stats={rewards.getStats(activeSessionMode || practiceMode, effectiveLevel())}
              newBadge={rewards.newBadge}
              onClearNewBadge={rewards.clearNewBadge}
            />
            {/* Header: word metadata + pronounce */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pb-3 border-b border-border/50">
              <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1 font-medium">
                  Level {word.level}
                </span>
                <span
                  className={cn(
                    "text-xs rounded-full px-2.5 py-1 font-medium",
                    word.difficulty === "easy"
                      ? "bg-success/10 text-success"
                      : word.difficulty === "medium"
                        ? "bg-warning/10 text-warning"
                        : "bg-destructive/10 text-destructive",
                  )}
                >
                  {word.difficulty}
                </span>
              </div>
              <div className="md:col-span-3 flex flex-col items-center">
                <button
                  onClick={playPronunciation}
                  disabled={audioLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold transition-all bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-lg"
                >
                  {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                  {audioLoading ? "Loading…" : "Hear the Word"}
                </button>
                {audioError && <p className="text-xs text-destructive mt-1">{audioError}</p>}
              </div>
            </div>

            {/* Support cards + input — two columns on lg before submission; full width after */}
            {!submitted ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-display mb-2 px-3">
                    Hints
                  </h3>
                  <SupportCard
                    type="definition"
                    content={word.definition}
                    isOpen={defOpen}
                    onToggle={toggleDef}
                  />
                  <SupportCard
                    type="example"
                    content={word.exampleSentence}
                    isOpen={exOpen}
                    onToggle={toggleEx}
                  />
                  <SupportCard type="origin" content={word.origin} isOpen={origOpen} onToggle={toggleOrig} />
                  <SupportCard type="partOfSpeech" content={word.partOfSpeech} isOpen={posOpen} onToggle={togglePos} />
                </div>

                <div className="md:col-span-3 flex flex-col">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-display mb-2 px-3">
                    Your answer
                  </h3>
                  <input
                    ref={inputRef}
                    type="text"
                    value={attempt}
                    onChange={(e) => setAttempt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="Type your spelling…"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-xl border-2 border-border bg-background px-4 py-4 text-center text-2xl font-display tracking-widest placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!attempt.trim() || submitting}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-sm transition-all bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting ? "Checking…" : "Submit"}
                  </button>
                  <VoiceMic
                    targetWord={word.word}
                    disabled={submitting || audioLoading}
                    onSpellingAttempt={(parsed) => {
                      usedVoiceInputRef.current = true;
                      setAttempt(parsed);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    onSupportResponse={(res) => {
                      if (res.intent === "definition") {
                        setDefOpen(true);
                        supportsViewed.current.definitionViewed = true;
                      } else if (res.intent === "example_sentence") {
                        setExOpen(true);
                        supportsViewed.current.exampleViewed = true;
                      } else if (res.intent === "origin") {
                        setOrigOpen(true);
                        supportsViewed.current.originViewed = true;
                      } else if (res.intent === "repeat_word" && !res.audioBase64) {
                        // Only play local pronunciation if backend didn't return its own audio.
                        // VoiceMic handles playback when audioBase64 is present — avoids double voices.
                        playPronunciation();
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              result && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="md:col-span-2 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-display mb-2 mx-[8px]">
                        Word details
                      </h3>
                      <SupportCard
                        type="definition"
                        content={word.definition}
                        isOpen={defOpen}
                        onToggle={toggleDef}
                      />
                      <SupportCard
                        type="example"
                        content={word.exampleSentence}
                        isOpen={exOpen}
                        onToggle={toggleEx}
                      />
                      <SupportCard type="origin" content={word.origin} isOpen={origOpen} onToggle={toggleOrig} />
                      <SupportCard type="partOfSpeech" content={word.partOfSpeech} isOpen={posOpen} onToggle={togglePos} />
                    </div>
                    <div className="md:col-span-3">
                      <div className="rounded-xl border border-border bg-background p-4 text-center space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your spelling</p>
                        <p
                          className={cn(
                            "text-2xl font-display tracking-widest",
                            result.correctness.isCorrect ? "text-success" : "text-destructive line-through decoration-2",
                          )}
                        >
                          {attempt}
                        </p>
                        {!result.correctness.isCorrect && (
                          <>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">
                              Correct spelling
                            </p>
                            <p className="text-2xl font-display tracking-widest text-success">{word.word}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <CoachingResult result={result} level={effectiveLevel()} targetWord={word.word} />
                  {streamErrors.length > 0 && (
                    <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground/80">
                      Some coaching details could not be loaded. You can continue with the feedback shown.
                    </div>
                  )}
                  <button
                    onClick={() => void handleNextWord()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
                  >
                    <ArrowRight className="h-4 w-4" /> Next Word
                  </button>
                </motion.div>
              )
            )}

          </motion.div>
        )}


        {/* Debug Panel */}
        <DebugPanel
          level={level}
          wordData={word}
          supports={supportsViewed.current}
          response={result}
          practiceMode={practiceMode}
          selectedCustomList={selectedCustomList}
          customPracticeActive={customPracticeActive}
          selectedForeignOrigin={selectedForeignOrigin}
          selectedForeignOriginDetails={selectedForeignOriginDetails}
          foreignPracticeActive={foreignPracticeActive}
        />

        <footer className="mt-10 pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AI Spelling Coach. All rights reserved.
          </p>
        </footer>
      </div>

      <LevelUpFlash streak={rewards.milestoneHit} onDone={rewards.clearMilestone} />
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <ActiveSessionConflictDialog
        open={!!pendingConflict}
        activeMode={pendingConflict?.activeMode ?? null}
        requestedMode={pendingConflict?.requestedMode ?? null}
        loading={conflictLoading}
        error={conflictError}
        onResume={handleConflictResume}
        onStartNew={handleConflictStartNew}
        onCancel={handleConflictCancel}
      />
    </div>
  );
}
