import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { History, Check, X } from "lucide-react";
import type { WordData, CoachingResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export type HistoryEntry = {
  word: WordData;
  attempt: string;
  result: CoachingResponse;
};

interface Props {
  history: HistoryEntry[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}

export function SessionHistoryPanel({ history, activeIndex, onSelect }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40 transition-colors"
          aria-label="Session history"
        >
          <History className="h-3.5 w-3.5" />
          History
          {history.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold">
              {history.length}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Words this session</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-6rem)] pr-1">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No words yet. Submit a spelling to start your history.
            </p>
          ) : (
            history.map((entry, i) => {
              const correct = entry.result.correctness?.isCorrect;
              const isActive = i === activeIndex;
              return (
                <button
                  key={i}
                  onClick={() => onSelect(i)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    isActive
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/50 bg-card/40 hover:bg-accent/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      correct ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{entry.word.word}</p>
                    {!correct && entry.attempt && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        You: <span className="line-through">{entry.attempt}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">#{i + 1}</span>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
