import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, ArrowRight, Volume2, Volume1, VolumeX, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { useCheer } from "@/hooks/use-cheer";
import { LevelSelector } from "@/components/LevelSelector";
import { SupportCard } from "@/components/SupportCard";
import { CoachingResult } from "@/components/CoachingResult";
import { DebugPanel } from "@/components/DebugPanel";
import { ThemePicker, type ThemeKey } from "@/components/ThemePicker";
import { type PracticeMode } from "@/components/PracticeModeSwitch";
import { CustomListPanel } from "@/components/CustomListPanel";
import { ForeignOriginPanel } from "@/components/ForeignOriginPanel";
import { ChannelsDashboard, type ChannelSelection } from "@/components/ChannelsDashboard";
import { RewardsStrip } from "@/components/RewardsStrip";
import { LevelUpFlash } from "@/components/LevelUpFlash";
import { DinoDecor } from "@/components/DinoDecor";
import { useRewards } from "@/hooks/use-rewards";
import { ArrowLeft, GraduationCap, List as ListIcon, Globe } from "lucide-react";
import { fetchNextWord, submitSpellingAttempt, fetchPronunciationAudio } from "@/lib/api";
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
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { AuthMenu } from "@/components/AuthMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type HistoryEntry } from "@/components/SessionHistoryPanel";
import { SessionHistorySidebar } from "@/components/SessionHistorySidebar";
import beePng from "@/assets/bee.png";
import { useAuth } from "@/hooks/use-auth";
import { PaymentDialog } from "@/components/PaymentDialog";
import { AuthDialog } from "@/components/AuthDialog";

const DEFAULT_PROFILE = {
  childId: "c1",
  age: 10,
  grade: "5",
  spellingLevel: "competition",
};

export default function Index() {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    return (localStorage.getItem("spelling-coach-theme") as ThemeKey) || "default";
  });
  const { soundEnabled, toggleSound, playCheer } = useCheer();
  const rewards = useRewards();
  const { user, subscribed } = useAuth();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [level, setLevel] = useState(0);
  const [word, setWord] = useState<WordData | null>(null);
  const [attempt, setAttempt] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachingResponse | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [defOpen, setDefOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [origOpen, setOrigOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);

  const supportsViewed = useRef<SupportsUsed>({ definitionViewed: false, exampleViewed: false, originViewed: false });

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

  // Session word history (per practice session)
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "default" ? "" : theme);
    localStorage.setItem("spelling-coach-theme", theme);
  }, [theme]);

  // Reset to default if current theme isn't allowed for the active level
  useEffect(() => {
    if (theme === "dino" && level !== 1) setTheme("default");
    if (theme === "sunset-sea" && level !== 3) setTheme("default");
    if (theme === "pastel-sky" && level !== 2) setTheme("default");
    if (theme === "rainbow" && level !== 1) setTheme("default");
  }, [level, theme]);

  const inputRef = useRef<HTMLInputElement>(null);

  const resetWordState = () => {
    setWord(null);
    setResult(null);
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
    supportsViewed.current = { definitionViewed: false, exampleViewed: false, originViewed: false };
    setSession((s) => ({ ...s, previousAttemptsOnThisWord: 0 }));
  };

  const loadWord = useCallback(async (params: NextWordParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
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
    supportsViewed.current = { definitionViewed: false, exampleViewed: false, originViewed: false };
    setSession((s) => ({ ...s, previousAttemptsOnThisWord: 0 }));
    try {
      const w = await fetchNextWord(params);
      setWord(w);
    } catch {
      setError("Could not load word. Check your connection.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const handleLevelChange = (lvl: number) => {
    setLevel(lvl);
    loadWord({ level: lvl });
  };

  const handleSelectChannel = (selection: ChannelSelection) => {
    resetWordState();
    setCustomPracticeActive(false);
    setForeignPracticeActive(false);

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
        setLevel(0);
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
        loadWord({ customListId: selection.list.id });
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
        loadWord({ foreignOrigin: selection.origin.origin });
        break;
    }
  };

  const handleBackToDashboard = () => {
    setActiveChannel(null);
    setCustomPracticeActive(false);
    setForeignPracticeActive(false);
    // Keep session history across dashboard visits; clears on reload.
    setActiveHistoryIndex(null);
    resetWordState();
  };

  const handleStartCustomPractice = () => {
    if (!selectedCustomList) return;
    setCustomPracticeActive(true);
    loadWord({ customListId: selectedCustomList.id });
  };

  const handleStartForeignPractice = () => {
    if (!selectedForeignOrigin) {
      setError("Please select an origin first.");
      return;
    }
    if (selectedForeignOrigin.wordCount === 0) {
      setError("This origin has no words available.");
      return;
    }
    setForeignPracticeActive(true);
    loadWord({ foreignOrigin: selectedForeignOrigin.origin });
  };

  const effectiveLevel = (): number => {
    if (practiceMode === "custom" && selectedCustomList) return Number(selectedCustomList.level) || level;
    return level;
  };

  const handleSubmit = async () => {
    if (!word || !attempt.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitSpellingAttempt({
        targetWord: word.word,
        childAttempt: attempt.trim().toLowerCase(),
        childProfile: DEFAULT_PROFILE,
        supportsUsed: { ...supportsViewed.current },
        sessionContext: session,
      });
      setResult(res);
      setHistory((h) => {
        const next = [...h, { word, attempt: attempt.trim(), result: res }];
        setActiveHistoryIndex(next.length - 1);
        return next;
      });
      const lvl = effectiveLevel();
      if (res.correctness?.isCorrect) {
        if (lvl !== 3) playCheer();
        rewards.recordCorrect(lvl);
        // Confetti only for Level 1 (younger kids). L2/L3 get streaks + fanfare instead.
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
      } else {
        rewards.recordIncorrect(lvl);
      }
      setSession((s) => ({
        ...s,
        previousAttemptsOnThisWord: s.previousAttemptsOnThisWord + 1,
        recentlyPracticedWords: [...s.recentlyPracticedWords.slice(-9), word.word],
      }));
    } catch {
      setError("Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextWord = () => {
    setActiveHistoryIndex(null);
    if (practiceMode === "custom" && customPracticeActive && selectedCustomList) {
      loadWord({ customListId: selectedCustomList.id });
    } else if (practiceMode === "foreignOrigin" && foreignPracticeActive && selectedForeignOrigin) {
      loadWord({ foreignOrigin: selectedForeignOrigin.origin });
    } else {
      loadWord({ level });
    }
  };

  const playPronunciation = async () => {
    if (!word || audioLoading) return;
    setAudioLoading(true);
    setAudioError(null);
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
  };

  const hasWord = !!word && !loading;
  const submitted = !!result;

  const showDashboard = activeChannel === null;
  const showStandardFlow = activeChannel === "standard";
  const showCustomSetup = activeChannel === "custom" && !customPracticeActive;
  const showForeignSetup = activeChannel === "foreignOrigin" && !foreignPracticeActive;
  const showPractice =
    showStandardFlow ||
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
            setWord(entry.word);
            setAttempt(entry.attempt);
            setResult(entry.result);
            setActiveHistoryIndex(i);
          }}
        />
      )}
      {/* Top app bar — webapp style */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-transparent backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-primary/10 transition-colors"
            title="Home"
          >
            <img src={beePng} alt="Spelling bee mascot" className="h-14 w-auto mt-1" />
            <span className="text-lg font-display tracking-tight text-foreground font-serif font-semibold">
              AI Spelling Coach
            </span>
          </button>
          <div className="flex items-center gap-1">
            <AuthMenu />
            {showPractice && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSound}
                    className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    aria-label="Sound"
                  >
                    {soundEnabled ? <Volume1 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sound</TooltipContent>
              </Tooltip>
            )}
            <ThemePicker current={theme} onChange={setTheme} level={showDashboard ? undefined : effectiveLevel()} />
          </div>
        </div>
      </header>

      <div className={cn(
        "mx-auto px-4 sm:px-8 py-6 sm:py-10",
        showDashboard ? "max-w-6xl" : "max-w-3xl"
      )}>

        {/* Dashboard or active channel header */}
        {showDashboard ? (
          <ChannelsDashboard onSelectChannel={handleSelectChannel} />
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
              onClick={() => {
                setCustomPracticeActive(false);
                resetWordState();
              }}
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
              onClick={() => {
                setForeignPracticeActive(false);
                resetWordState();
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Change Origin
            </button>
          </div>
        )}

        {/* Standard: Level Selector (only before a word is loaded) */}
        {showStandardFlow && !hasWord && !loading && (
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
          </motion.div>
        )}

        {/* Start prompt (standard mode only) */}
        {showStandardFlow && !word && !loading && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <p className="text-muted-foreground">Choose a level above to begin.</p>
          </motion.div>
        )}


        {/* Loading */}
        {showPractice && loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {showPractice && error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center text-sm text-destructive mb-4">
            {error}
            <button onClick={handleNextWord} className="block mx-auto mt-2 underline text-xs">
              Retry
            </button>
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
              stats={rewards.getStats(effectiveLevel())}
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
                  <CoachingResult result={result} level={level} />
                  <button
                    onClick={handleNextWord}
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
    </div>
  );
}
