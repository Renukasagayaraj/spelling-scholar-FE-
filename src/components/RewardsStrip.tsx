import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy } from "lucide-react";
import { useEffect } from "react";
import { BADGES, type LevelStats, type BadgeDef } from "@/hooks/use-rewards";
import { cn } from "@/lib/utils";

interface RewardsStripProps {
  stats: LevelStats;
  newBadge: BadgeDef | null;
  onClearNewBadge: () => void;
}

export function RewardsStrip({ stats, newBadge, onClearNewBadge }: RewardsStripProps) {
  useEffect(() => {
    if (!newBadge) return;
    const t = setTimeout(onClearNewBadge, 3500);
    return () => clearTimeout(t);
  }, [newBadge, onClearNewBadge]);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm px-4 py-2.5">
        {/* Streak */}
        <div className="flex items-center gap-1.5">
          <Flame className={cn("h-4 w-4", stats.streak > 0 ? "text-orange-500" : "text-muted-foreground")} />
          <span className="text-sm font-semibold text-foreground">{stats.streak}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">streak</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Total */}
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{stats.totalCorrect}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">mastered</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {BADGES.map((b) => {
            const earned = stats.badges.includes(b.id);
            return (
              <div
                key={b.id}
                title={`${b.label} — ${b.description}${earned ? "" : " (locked)"}`}
                className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full text-base transition-all",
                  earned
                    ? "bg-gradient-to-br from-amber-300 to-orange-400 shadow-md ring-1 ring-amber-500/40"
                    : "bg-muted text-muted-foreground/40 grayscale opacity-50",
                )}
              >
                <span>{b.emoji}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* New badge toast */}
      <AnimatePresence>
        {newBadge && (
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.9 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 flex items-center gap-3 rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 shadow-xl"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-xl shadow">
              {newBadge.emoji}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Badge unlocked</p>
              <p className="text-sm font-semibold text-amber-950">{newBadge.label}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
