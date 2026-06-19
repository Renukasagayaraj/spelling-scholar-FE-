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

type AllStats = Record<number, LevelStats>;

const empty = (): LevelStats => ({ streak: 0, bestStreak: 0, totalCorrect: 0, badges: [] });

function loadAll(): AllStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function useRewards() {
  const [all, setAll] = useState<AllStats>(() => loadAll());
  const [newBadge, setNewBadge] = useState<BadgeDef | null>(null);
  const [milestoneHit, setMilestoneHit] = useState<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
  }, [all]);

  const getStats = useCallback((level: number): LevelStats => all[level] ?? empty(), [all]);

  const playFanfare = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch {}
  }, []);

  const recordCorrect = useCallback((level: number) => {
    setAll((prev) => {
      const cur = prev[level] ?? empty();
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

      return { ...prev, [level]: next };
    });
  }, [playFanfare]);

  const recordIncorrect = useCallback((level: number) => {
    setAll((prev) => {
      const cur = prev[level] ?? empty();
      return { ...prev, [level]: { ...cur, streak: 0 } };
    });
  }, []);

  const clearNewBadge = useCallback(() => setNewBadge(null), []);
  const clearMilestone = useCallback(() => setMilestoneHit(null), []);

  return {
    getStats,
    recordCorrect,
    recordIncorrect,
    newBadge,
    milestoneHit,
    clearNewBadge,
    clearMilestone,
    allBadges: BADGES,
  };
}
