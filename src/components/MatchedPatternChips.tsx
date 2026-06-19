import { cn } from "@/lib/utils";

export interface MatchedPattern {
  label: string;
  matchedText?: string;
  matchedParts?: string[];
}

interface MatchedPatternChipsProps {
  patterns: MatchedPattern[];
  title?: string;
}

export function MatchedPatternChips({ patterns, title }: MatchedPatternChipsProps) {
  if (!patterns || patterns.length === 0) return null;
  return (
    <div>
      {title && (
        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
          {title}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {patterns.map((p, i) => {
          const detail =
            p.matchedParts && p.matchedParts.length > 0
              ? p.matchedParts.join(" + ")
              : p.matchedText;
          return (
            <span
              key={`${p.label}-${i}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-chip text-chip-foreground"
              )}
            >
              <span>{p.label}</span>
              {detail && (
                <span className="rounded-full bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                  {detail}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
