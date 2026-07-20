import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MorphemeGloss } from "@/lib/api";

interface MorphemeGlossChipsProps {
  word: string;
  glosses: MorphemeGloss[];
  title?: string;
}

type Variant = {
  box: string;
  border: string;
  part: string;
  role: string;
  roleBg: string;
  meaning: string;
};

const VARIANTS: Variant[] = [
  {
    box: "bg-primary/10",
    border: "border-primary/20",
    part: "text-primary",
    role: "text-primary/80",
    roleBg: "bg-primary/15",
    meaning: "text-primary/90",
  },
  {
    box: "bg-chip-accent",
    border: "border-chip-accent-foreground/20",
    part: "text-chip-accent-foreground",
    role: "text-chip-accent-foreground/80",
    roleBg: "bg-chip-accent-foreground/15",
    meaning: "text-chip-accent-foreground/90",
  },
  {
    box: "bg-chip-warm",
    border: "border-chip-warm-foreground/20",
    part: "text-chip-warm-foreground",
    role: "text-chip-warm-foreground/80",
    roleBg: "bg-chip-warm-foreground/15",
    meaning: "text-chip-warm-foreground/90",
  },
  {
    box: "bg-secondary/15",
    border: "border-secondary/25",
    part: "text-secondary",
    role: "text-secondary/80",
    roleBg: "bg-secondary/20",
    meaning: "text-secondary/90",
  },
];

function variantFor(index: number): Variant {
  return VARIANTS[index % VARIANTS.length];
}

export function MorphemeGlossChips({ word, glosses, title = "Morpheme Breakdown" }: MorphemeGlossChipsProps) {
  if (!glosses || glosses.length === 0) return null;

  const items: React.ReactNode[] = [];
  glosses.forEach((gloss, i) => {
    const v = variantFor(i);
    items.push(
      <motion.div
        key={`${gloss.part}-${i}`}
        initial={{ scale: 0.85, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: i * 0.08, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        className={cn(
          "flex-1 min-w-[4.5rem] rounded-lg border p-2.5 text-center transition-shadow hover:shadow-md",
          v.box,
          v.border
        )}
        title={gloss.origin ? `${gloss.origin} origin` : undefined}
      >
        <div className={cn("text-base font-bold font-display leading-tight", v.part)}>{gloss.part}</div>
        <div
          className={cn(
            "inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
            v.roleBg,
            v.role
          )}
        >
          {gloss.role}
        </div>
        <div className={cn("mt-1 text-xs font-medium italic leading-snug", v.meaning)}>{gloss.meaning}</div>
      </motion.div>
    );
    if (i < glosses.length - 1) {
      items.push(
        <motion.span
          key={`plus-${i}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 + 0.05 }}
          className="flex items-center text-muted-foreground/40 font-light text-xl px-0.5 select-none"
          aria-hidden
        >
          +
        </motion.span>
      );
    }
  });

  return (
    <div className="space-y-2.5">
      {title && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      )}
      <div className="flex flex-wrap items-stretch gap-1">{items}</div>
      <p className="text-center text-sm font-medium text-foreground/80">
        <span className="font-display font-semibold">{word}</span> ={" "}
        {glosses.map((g, i) => (
          <span key={i}>
            <span className="font-semibold">{g.part}</span>
            <span className="text-muted-foreground"> ({g.meaning})</span>
            {i < glosses.length - 1 && <span className="text-muted-foreground/60"> + </span>}
          </span>
        ))}
      </p>
    </div>
  );
}
