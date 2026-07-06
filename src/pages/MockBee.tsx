import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  MessageSquareQuote,
  Send,
  Sparkles,
  Tag,
  Trophy,
  Volume2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthMenu } from "@/components/AuthMenu";
import { useAuth } from "@/hooks/use-auth";
import { fetchCustomLists, type CustomListSummary } from "@/lib/api";
import {
  createMockBeeRound,
  fetchMockBeeCurrentWordAudio,
  fetchMockBeeReview,
  submitMockBeeAttempt,
  timeoutMockBee,
  TIMER_BY_LEVEL,
  type MockBeeChallenge,
  type MockBeeLevel,
  type MockBeeSession,
  type MockBeeWordCount,
  type MockBeeWordSource,
  type ReviewWord,
} from "@/lib/mockBeeApi";
import { CoachingResult } from "@/components/CoachingResult";
import beePng from "@/assets/bee.png";

const DEFAULT_PROFILE = { childId: "c1", age: 10, grade: "5", spellingLevel: "level_2" };

type Stage = "setup" | "round" | "review";

const LEVEL_META: Record<MockBeeLevel, { label: string; subtitle: string; seconds: number; countdown: boolean }> = {
  "1": { label: "Level 1", subtitle: "60s • no countdown", seconds: 60, countdown: false },
  "2": { label: "Level 2", subtitle: "45s • visible timer", seconds: 45, countdown: true },
  "3": { label: "Level 3", subtitle: "30s • answer hidden", seconds: 30, countdown: true },
};

export default function MockBee() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Setup state
  const [stage, setStage] = useState<Stage>("setup");
  const [level, setLevel] = useState<MockBeeLevel>("1");
  const [wordSource, setWordSource] = useState<MockBeeWordSource>("standard");
  const [wordCount, setWordCount] = useState<MockBeeWordCount>(10);
  const [customLists, setCustomLists] = useState<CustomListSummary[]>([]);
  const [customListId, setCustomListId] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Round state
  const [session, setSession] = useState<MockBeeSession | null>(null);
  const [attempt, setAttempt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ correctWord?: string; isCorrect: boolean; revealed: boolean } | null>(null);
  const [showReadyPrompt, setShowReadyPrompt] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const audioUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supportsUsed = useRef({ definitionViewed: false, exampleViewed: false, originViewed: false });
  const [defOpen, setDefOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [origOpen, setOrigOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);

  // Review state
  const [reviewWords, setReviewWords] = useState<ReviewWord[] | null>(null);
  const [reviewPending, setReviewPending] = useState(0);
  const [openReviewIndex, setOpenReviewIndex] = useState<number | null>(0);

  // Load custom lists when authenticated
  useEffect(() => {
    if (!user) return;
    fetchCustomLists()
      .then((r) => setCustomLists(r.lists || []))
      .catch(() => setCustomLists([]));
  }, [user]);

  const challenge: MockBeeChallenge | null = session?.currentChallenge ?? null;

  // Reset timer state on new challenge — countdown waits for the child to hear the word.
  useEffect(() => {
    if (stage !== "round" || !challenge) return;
    setElapsed(0);
    setShowReadyPrompt(false);
    setTimerStarted(false);
  }, [challenge?.turnIndex, stage]);

  // Timer effect: only ticks once the pronunciation has finished playing.
  useEffect(() => {
    if (stage !== "round" || !challenge || !timerStarted) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const e = Math.floor((Date.now() - start) / 1000);
      setElapsed(e);
      const t = challenge.timer;
      if (t.readyPromptAtElapsedSeconds && e >= t.readyPromptAtElapsedSeconds) {
        setShowReadyPrompt(true);
      }
      if (e >= t.secondsPerWord) {
        clearInterval(interval);
        handleTimeout();
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.turnIndex, stage, timerStarted]);

  // Focus input on new challenge
  useEffect(() => {
    if (stage === "round" && challenge) setTimeout(() => inputRef.current?.focus(), 50);
  }, [challenge?.turnIndex, stage]);

  const resetTurnState = () => {
    setAttempt("");
    setLastResult(null);
    setShowReadyPrompt(false);
    setTimerStarted(false);
    setElapsed(0);
    setDefOpen(false);
    setExOpen(false);
    setOrigOpen(false);
    setPosOpen(false);
    supportsUsed.current = { definitionViewed: false, exampleViewed: false, originViewed: false };
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  const handleStart = async () => {
    setSetupError(null);
    if (wordSource === "custom_list" && !customListId) {
      setSetupError("Pick a custom list to continue.");
      return;
    }
    setCreating(true);
    try {
      const s = await createMockBeeRound({
        level,
        wordSource,
        customListId: customListId || undefined,
        wordCount,
        childProfile: { ...DEFAULT_PROFILE, spellingLevel: `level_${level}` },
      });
      setSession(s);
      setStage("round");
      resetTurnState();
    } catch {
      setSetupError("Could not start the round. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const goToReview = useCallback(async (sid: string) => {
    setStage("review");
    setReviewWords(null);
    try {
      const r = await fetchMockBeeReview(sid);
      setReviewWords(r.words);
      setReviewPending(r.reviewStatus.pending);
    } catch {
      setReviewWords([]);
      setReviewPending(0);
    }
  }, []);

  // Poll review until pending = 0
  useEffect(() => {
    if (stage !== "review" || !session) return;
    if (reviewPending === 0 && reviewWords && reviewWords.length > 0) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetchMockBeeReview(session.id);
        setReviewWords(r.words);
        setReviewPending(r.reviewStatus.pending);
      } catch {
        // ignore
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [stage, session, reviewPending, reviewWords]);

  const advanceFromResponse = (next: MockBeeSession) => {
    setSession(next);
    if (next.status === "completed") {
      goToReview(next.id);
    } else {
      // Brief delay before clearing reveal so kids see correct/incorrect
      const delay = next.config.level === "3" ? 400 : 1200;
      setTimeout(() => {
        resetTurnState();
      }, delay);
    }
  };

  const handleSubmit = async () => {
    if (!session || !challenge || !attempt.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitMockBeeAttempt(session.id, {
        childAttempt: attempt.trim(),
        supportsUsed: { ...supportsUsed.current },
      });
      setLastResult({
        correctWord: res.result.correctWord,
        isCorrect: res.result.isCorrect,
        revealed: res.result.revealAnswer,
      });
      advanceFromResponse(res.session);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimeout = async () => {
    if (!session) return;
    try {
      const res = await timeoutMockBee(session.id);
      setLastResult({ isCorrect: false, revealed: false });
      advanceFromResponse(res.session);
    } catch {
      // ignore
    }
  };

  const handleHearWord = async () => {
    if (!session || audioLoading) return;
    setAudioLoading(true);
    try {
      const url = await fetchMockBeeCurrentWordAudio(session.id);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      // Start the countdown only after pronunciation finishes (or errors out).
      const startTimerOnce = () => setTimerStarted((v) => v || true);
      audio.onended = startTimerOnce;
      audio.onerror = startTimerOnce;
      await audio.play();
    } catch {
      // If audio fails entirely, still let the round proceed.
      setTimerStarted(true);
    } finally {
      setAudioLoading(false);
    }
  };

  const remaining = challenge ? Math.max(0, challenge.timer.secondsPerWord - elapsed) : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-transparent backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-primary/10 transition-colors"
          >
            <img src={beePng} alt="Spelling bee mascot" className="h-14 w-auto mt-1" />
            <span className="text-lg font-display tracking-tight text-foreground font-serif font-semibold">
              AI Spelling Coach
            </span>
          </button>
          <AuthMenu />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-2">
          <button
            onClick={() => (stage === "setup" ? navigate("/") : setStage("setup"))}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5 hover:bg-accent/30"
          >
            <ArrowLeft className="h-4 w-4" />
            {stage === "setup" ? "Back to dashboard" : "Exit round"}
          </button>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            Mock Bee
          </div>
        </div>

        {stage === "setup" && (
          <SetupView
            level={level}
            setLevel={setLevel}
            wordSource={wordSource}
            setWordSource={setWordSource}
            wordCount={wordCount}
            setWordCount={setWordCount}
            customLists={customLists}
            customListId={customListId}
            setCustomListId={setCustomListId}
            authed={!!user}
            error={setupError}
            creating={creating}
            onStart={handleStart}
          />
        )}

        {stage === "round" && session && challenge && (
          <RoundView
            session={session}
            challenge={challenge}
            attempt={attempt}
            setAttempt={setAttempt}
            inputRef={inputRef}
            submitting={submitting}
            onSubmit={handleSubmit}
            onHearWord={handleHearWord}
            audioLoading={audioLoading}
            elapsed={elapsed}
            remaining={remaining}
            showReadyPrompt={showReadyPrompt}
            lastResult={lastResult}
            defOpen={defOpen}
            exOpen={exOpen}
            origOpen={origOpen}
            posOpen={posOpen}
            onToggleDef={() => {
              setDefOpen((v) => !v);
              supportsUsed.current.definitionViewed = true;
            }}
            onToggleEx={() => {
              setExOpen((v) => !v);
              supportsUsed.current.exampleViewed = true;
            }}
            onToggleOrig={() => {
              setOrigOpen((v) => !v);
              supportsUsed.current.originViewed = true;
            }}
            onTogglePos={() => setPosOpen((v) => !v)}
          />
        )}

        {stage === "review" && session && (
          <ReviewView
            session={session}
            words={reviewWords}
            pending={reviewPending}
            openIndex={openReviewIndex}
            setOpenIndex={setOpenReviewIndex}
            onNewRound={() => {
              setSession(null);
              setReviewWords(null);
              setStage("setup");
            }}
          />
        )}
      </div>
    </div>
  );
}

// ===== Setup =====

interface SetupViewProps {
  level: MockBeeLevel;
  setLevel: (l: MockBeeLevel) => void;
  wordSource: MockBeeWordSource;
  setWordSource: (s: MockBeeWordSource) => void;
  wordCount: MockBeeWordCount;
  setWordCount: (n: MockBeeWordCount) => void;
  customLists: CustomListSummary[];
  customListId: string | null;
  setCustomListId: (id: string | null) => void;
  authed: boolean;
  error: string | null;
  creating: boolean;
  onStart: () => void;
}

function SetupView(p: SetupViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm p-6 sm:p-8 space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" />
          Mock Spelling Bee
        </div>
        <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-foreground font-serif font-semibold">
          Set up your round
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a level, word list, and number of words. Coaching feedback comes after the round ends.
        </p>
      </div>

      {/* Level */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Level</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(LEVEL_META) as MockBeeLevel[]).map((lvl) => {
            const meta = LEVEL_META[lvl];
            const active = p.level === lvl;
            return (
              <button
                key={lvl}
                onClick={() => p.setLevel(lvl)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                <p className="font-display font-semibold text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.subtitle}</p>
                {lvl === "3" && (
                  <p className="text-[10px] text-warning mt-1 font-medium">Answers shown only at the end</p>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Word source */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Word list</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => p.setWordSource("standard")}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              p.wordSource === "standard"
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <p className="font-display font-semibold text-foreground">Standard practice</p>
            <p className="text-xs text-muted-foreground mt-0.5">Curated words for the chosen level.</p>
          </button>
          <button
            onClick={() => p.setWordSource("custom_list")}
            disabled={!p.authed}
            className={cn(
              "rounded-xl border p-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed",
              p.wordSource === "custom_list"
                ? "border-primary bg-primary/5"
                : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <p className="font-display font-semibold text-foreground">My word lists</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {p.authed ? "Practice from a saved custom list." : "Sign in to use saved lists."}
            </p>
          </button>
        </div>
        {p.wordSource === "custom_list" && (
          <div className="pt-2">
            {p.customLists.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No custom lists yet. Create one in My Word Lists.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {p.customLists.map((l) => {
                  const active = p.customListId === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => p.setCustomListId(l.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-all",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/40",
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">{l.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Level {l.level} · {l.wordCount} words
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Word count */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Number of words</h3>
        <div className="grid grid-cols-3 gap-3">
          {([10, 20, 30] as MockBeeWordCount[]).map((n) => (
            <button
              key={n}
              onClick={() => p.setWordCount(n)}
              className={cn(
                "rounded-xl border py-3 text-center transition-all font-display font-semibold",
                p.wordCount === n
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/40",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {p.error && <p className="text-sm text-destructive text-center">{p.error}</p>}

      <button
        onClick={p.onStart}
        disabled={p.creating}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
      >
        {p.creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
        {p.creating ? "Starting…" : "Start round"}
      </button>
    </motion.div>
  );
}

// ===== Round =====

interface RoundViewProps {
  session: MockBeeSession;
  challenge: MockBeeChallenge;
  attempt: string;
  setAttempt: (s: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  submitting: boolean;
  onSubmit: () => void;
  onHearWord: () => void;
  audioLoading: boolean;
  elapsed: number;
  remaining: number;
  showReadyPrompt: boolean;
  lastResult: { correctWord?: string; isCorrect: boolean; revealed: boolean } | null;
  defOpen: boolean;
  exOpen: boolean;
  origOpen: boolean;
  posOpen: boolean;
  onToggleDef: () => void;
  onToggleEx: () => void;
  onToggleOrig: () => void;
  onTogglePos: () => void;
}

function RoundView(p: RoundViewProps) {
  const { progress } = p.session;
  const supports = p.challenge.supports;
  const { showCountdown, secondsPerWord } = p.challenge.timer;
  const pct = Math.min(100, (p.elapsed / secondsPerWord) * 100);
  const reveal = p.lastResult?.revealed && p.lastResult.correctWord;

  return (
    <motion.div
      key={p.challenge.turnIndex}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm p-6 sm:p-8 space-y-4"
    >
      {/* Progress + timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-display font-semibold text-foreground">
            Word {p.challenge.turnNumber} / {progress.totalWords}
          </span>
          <span className="text-xs">·</span>
          <span className="text-xs">
            <span className="text-success font-medium">{progress.correctCount} ✓</span>
            <span className="mx-1">·</span>
            <span className="text-destructive font-medium">{progress.incorrectCount} ✗</span>
            {progress.timedOutCount > 0 && (
              <>
                <span className="mx-1">·</span>
                <span className="text-warning font-medium">{progress.timedOutCount} ⏱</span>
              </>
            )}
          </span>
        </div>
        <span className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-1 font-medium">
          Level {p.session.config.level}
        </span>
      </div>

      {/* Countdown bar (always animated; numeric only when showCountdown) */}
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn(
              "h-full",
              p.remaining <= 10 && showCountdown ? "bg-destructive" : "bg-primary",
            )}
            initial={false}
            animate={{ width: `${100 - pct}%` }}
            transition={{ duration: 0.25, ease: "linear" }}
          />
        </div>
        {showCountdown && (
          <p className="text-xs text-right text-muted-foreground">
            <span className={cn("font-mono font-semibold", p.remaining <= 10 && "text-destructive")}>
              {p.remaining}s
            </span>{" "}
            left
          </p>
        )}
      </div>

      {/* Ready prompt for L1 */}
      <AnimatePresence>
        {p.showReadyPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-center"
          >
            <p className="text-sm font-semibold text-warning">Ready to spell?</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hear word */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={p.onHearWord}
          disabled={p.audioLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold transition-all bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 shadow-sm hover:shadow-md text-lg"
        >
          {p.audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
          {p.audioLoading ? "Loading…" : "Hear the Word"}
        </button>
      </div>

      {/* Supports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SupportRow icon={BookOpen} label="Definition" content={supports.definition} open={p.defOpen} onToggle={p.onToggleDef} />
        <SupportRow icon={MessageSquareQuote} label="Example sentence" content={supports.exampleSentence} open={p.exOpen} onToggle={p.onToggleEx} />
        <SupportRow icon={Globe} label="Origin" content={supports.origin} open={p.origOpen} onToggle={p.onToggleOrig} />
        <SupportRow icon={Tag} label="Part of speech" content={supports.partOfSpeech} open={p.posOpen} onToggle={p.onTogglePos} />
      </div>

      {/* Reveal banner (L1/L2 only) */}
      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "rounded-xl border p-3 text-center",
              p.lastResult!.isCorrect
                ? "border-success/40 bg-success/10"
                : "border-destructive/40 bg-destructive/10",
            )}
          >
            <div className="flex items-center justify-center gap-2 text-sm font-semibold">
              {p.lastResult!.isCorrect ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {p.lastResult!.isCorrect ? "Correct!" : "Not quite"}
              <span className="text-muted-foreground font-normal">·</span>
              <span className="font-display tracking-wide">{p.lastResult!.correctWord}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="space-y-2">
        <input
          ref={p.inputRef}
          type="text"
          value={p.attempt}
          onChange={(e) => p.setAttempt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && p.onSubmit()}
          placeholder="Type your spelling…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border-2 border-border bg-background px-4 py-4 text-center text-2xl font-display tracking-widest placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={p.onSubmit}
          disabled={!p.attempt.trim() || p.submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          {p.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {p.submitting ? "Checking…" : "Submit"}
        </button>
      </div>
    </motion.div>
  );
}

function SupportRow({
  icon: Icon,
  label,
  content,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  content: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all w-full text-left",
          open ? "bg-chip text-chip-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg bg-chip/60 text-chip-foreground px-4 py-3 mt-1.5 text-sm leading-relaxed">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Review =====

interface ReviewViewProps {
  session: MockBeeSession;
  words: ReviewWord[] | null;
  pending: number;
  openIndex: number | null;
  setOpenIndex: (i: number | null) => void;
  onNewRound: () => void;
}

function ReviewView(p: ReviewViewProps) {
  const total = p.session.progress.totalWords;
  const { correctCount, incorrectCount, timedOutCount } = p.session.progress;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Summary */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm p-6 text-center space-y-2">
        <Trophy className="h-10 w-10 text-warning mx-auto" />
        <h2 className="text-2xl font-display font-serif font-semibold text-foreground">Round complete!</h2>
        <p className="text-sm text-muted-foreground">
          You got <span className="font-semibold text-success">{correctCount}</span> of {total} correct ({pct}%).
        </p>
        <div className="flex items-center justify-center gap-3 text-xs pt-1">
          <span className="rounded-full bg-success/10 text-success px-2.5 py-1 font-medium">{correctCount} correct</span>
          <span className="rounded-full bg-destructive/10 text-destructive px-2.5 py-1 font-medium">{incorrectCount} wrong</span>
          {timedOutCount > 0 && (
            <span className="rounded-full bg-warning/10 text-warning px-2.5 py-1 font-medium">{timedOutCount} timed out</span>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={p.onNewRound}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            <ArrowRight className="h-4 w-4" />
            Start a new round
          </button>
        </div>
      </div>

      {/* Pending notice */}
      {p.pending > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Coaching feedback is being prepared for {p.pending} {p.pending === 1 ? "word" : "words"}…
        </div>
      )}

      {/* Word cards */}
      {!p.words ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {p.words.map((w, i) => (
            <ReviewCard
              key={i}
              word={w}
              level={Number(p.session.config.level)}
              open={p.openIndex === i}
              onToggle={() => p.setOpenIndex(p.openIndex === i ? null : i)}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ReviewCard({
  word,
  level,
  open,
  onToggle,
}: {
  word: ReviewWord;
  level: number;
  open: boolean;
  onToggle: () => void;
}) {
  const statusIcon = word.status === "timed_out" ? (
    <span className="text-warning text-xs font-medium">timed out</span>
  ) : word.isCorrect ? (
    <CheckCircle2 className="h-4 w-4 text-success" />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" />
  );

  const cardReady = word.reviewCardStatus === "completed" && word.reviewCard;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">{word.turnNumber}.</span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-foreground truncate">{word.word}</p>
            {word.childAttempt && word.childAttempt.toLowerCase() !== word.word.toLowerCase() && (
              <p className="text-xs text-muted-foreground truncate">
                You wrote: <span className="line-through">{word.childAttempt}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusIcon}
          {word.reviewCardStatus === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-background/50 p-4">
              {cardReady ? (
                <CoachingResult result={word.reviewCard!} level={level} />
              ) : word.reviewCardStatus === "failed" ? (
                <p className="text-sm text-muted-foreground italic">Coaching unavailable for this word.</p>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing feedback…
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
