import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

interface LevelUpFlashProps {
  streak: number | null;
  onDone: () => void;
}

export function LevelUpFlash({ streak, onDone }: LevelUpFlashProps) {
  useEffect(() => {
    if (streak === null) return;
    const t = setTimeout(onDone, 1100);
    return () => clearTimeout(t);
  }, [streak, onDone]);

  return (
    <AnimatePresence>
      {streak !== null && (
        <>
          {/* Screen flash */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, times: [0, 0.2, 1] }}
            className="fixed inset-0 z-[60] pointer-events-none bg-gradient-to-br from-primary/40 via-secondary/30 to-accent/40"
          />
          {/* Center banner */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="fixed inset-0 z-[61] pointer-events-none flex items-center justify-center"
          >
            <div className="rounded-2xl bg-background/95 border-2 border-primary px-8 py-5 shadow-2xl text-center backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Streak</p>
              <p className="font-display text-5xl font-bold text-foreground mt-1">{streak} 🔥</p>
              <p className="text-xs text-muted-foreground mt-1">in a row</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
