import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "spelling-coach-rewards-v1";

export interface LevelStats {
  streak: number;
  bestStreak: number;
  totalCorrect: number;
  badges: string[];
}

export interface BadgeDef {
  id: string;
  label: string;
  emoji: string;
  description: string;
  check: (s: LevelStats) => boolean;
}

export const BADGES: BadgeDef[] = [
  { id: "streak3", label: "On a Roll", emoji: "🔥", description: "3 in a row", check: (s) => s.bestStreak >= 3 },
  { id: "streak5", label: "Word Master", emoji: "🏆", description: "5 in a row", check: (s) => s.bestStreak >= 5 },
  { id: "total25", label: "Quarter Century", emoji: "💎", description: "25 words correct", check: (s) => s.totalCorrect >= 25 },
  { id: "streak10", label: "Spelling Star", emoji: "⭐", description: "10 in a row", check: (s) => s.bestStreak >= 10 },
  { id: "total50", label: "Half Century", emoji: "👑", description: "50 words correct", check: (s) => s.totalCorrect >= 50 },
];

const MILESTONES = [3, 5, 10, 15, 20];

type AllStats = Record<string, LevelStats>;
type RewardStatsRow = {
  mode: string;
  origin_language?: string | null;
  custom_list_id?: string | null;
  current_streak?: number | null;
  best_streak?: number | null;
  correct_attempts?: number | null;
  badges?: string[] | null;
};
type AudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

const empty = (): LevelStats => ({ streak: 0, bestStreak: 0, totalCorrect: 0, badges: [] });

function normalizeStandardLevel(level?: number): 1 | 2 | 3 {
  if (level == null) {
    throw new Error("level is required when mode is standard");
  }

  if (level !== 1 && level !== 2 && level !== 3) {
    throw new Error("level must be 1, 2, or 3 when mode is standard");
  }

  return level;
}

function getRewardsKey(mode: any, level?: number): string {
  if (typeof mode === "number" || (typeof mode === "string" && /^\d+$/.test(mode))) {
    return String(mode);
  }
  const modeStr = String(mode || "");
  if (modeStr === "standard") {
    return `standard_level_${normalizeStandardLevel(level)}`;
  }

  if (modeStr.startsWith("standard_level_")) {
    const parsedLevel = Number(modeStr.replace("standard_level_", ""));
    normalizeStandardLevel(parsedLevel);
    return modeStr;
  }

  if (modeStr.startsWith("custom_list_") || modeStr === "custom") {
    return modeStr.startsWith("custom_list_") ? modeStr : "custom";
  }

  if (modeStr.startsWith("foreign_origin_") || modeStr === "foreign_origin" || modeStr === "foreignOrigin") {
    if (modeStr.startsWith("foreign_origin_")) {
      return modeStr;
    }

    return "foreign_origin";
  }

  if (modeStr === "mock_bee" || modeStr === "mock-bee") {
    return "mock_bee";
  }

  return modeStr;
}

function getRewardsKeyFromDbRow(row: RewardStatsRow): string {
  if (row.mode === "foreign_origin" && row.origin_language) {
    return `foreign_origin_${row.origin_language}`;
  }

  if (row.mode === "custom" && row.custom_list_id) {
    return `custom_list_${row.custom_list_id}`;
  }

  return row.mode;
}

function loadAll(): AllStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_error) {
    return {};
  }
}

export function useRewards() {
  const [all, setAll] = useState<AllStats>(() => loadAll());
  const [newBadge, setNewBadge] = useState<BadgeDef | null>(null);
  const [milestoneHit, setMilestoneHit] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (_error) {
      // Ignore storage write failures so rewards never block practice.
    }
  }, [all]);

  const getStats = useCallback((mode: string, level?: number): LevelStats => {
    const key = getRewardsKey(mode, level);
    return all[key] ?? empty();
  }, [all]);

  const playFanfare = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const audioWindow = window as AudioWindow;
        const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;

        if (!AudioContextCtor) {
          return;
        }

        audioCtxRef.current = new AudioContextCtor();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      // Triumphant ascending arpeggio: C5, E5, G5, C6
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const start = now + i * 0.08;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch (_error) {
      // Ignore audio failures so streak tracking still works.
    }
  }, []);

  const recordCorrect = useCallback((mode: string, level?: number) => {
    const key = getRewardsKey(mode, level);
    setAll((prev) => {
      const cur = prev[key] ?? empty();
      const streak = cur.streak + 1;
      const totalCorrect = cur.totalCorrect + 1;
      const bestStreak = Math.max(cur.bestStreak, streak);
      const next: LevelStats = { ...cur, streak, totalCorrect, bestStreak };

      // Badge unlocks
      const newlyEarned = BADGES.filter((b) => !next.badges.includes(b.id) && b.check(next));
      if (newlyEarned.length > 0) {
        next.badges = [...next.badges, ...newlyEarned.map((b) => b.id)];
        setNewBadge(newlyEarned[0]);
      }

      // Milestone (streak fanfare)
      if (MILESTONES.includes(streak)) {
        setMilestoneHit(streak);
        playFanfare();
      }

      return { ...prev, [key]: next };
    });
  }, [playFanfare]);

  const recordIncorrect = useCallback((mode: string, level?: number) => {
    const key = getRewardsKey(mode, level);
    setAll((prev) => {
      const cur = prev[key] ?? empty();
      return { ...prev, [key]: { ...cur, streak: 0 } };
    });
  }, []);

  const clearNewBadge = useCallback(() => setNewBadge(null), []);
  const clearMilestone = useCallback(() => setMilestoneHit(null), []);

  const syncWithDatabase = useCallback((dbStatsList: RewardStatsRow[]) => {
    setAll(() => {
      const next: AllStats = {};
      dbStatsList.forEach((row) => {
        const key = getRewardsKeyFromDbRow(row);
        next[key] = {
          streak: row.current_streak || 0,
          bestStreak: row.best_streak || 0,
          totalCorrect: row.correct_attempts || 0,
          badges: row.badges || [],
        };
      });
      return next;
    });
  }, []);

  return {
    getStats,
    recordCorrect,
    recordIncorrect,
    newBadge,
    milestoneHit,
    clearNewBadge,
    clearMilestone,
    syncWithDatabase,
    allBadges: BADGES,
  };
}
