import { Check, X, History, Download } from "lucide-react";
import type { HistoryEntry } from "@/components/SessionHistoryPanel";
import { downloadSessionReport } from "@/lib/sessionReport";
import { cn } from "@/lib/utils";

interface Props {
  history: HistoryEntry[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}

export function SessionHistorySidebar({ history, activeIndex, onSelect }: Props) {
  // newest on top
  const items = history.map((entry, i) => ({ entry, originalIndex: i })).reverse();

  return (
    <aside className="hidden xl:flex flex-col fixed left-4 top-24 w-64 max-h-[calc(100vh-7rem)] rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">History</h2>
        {history.length > 0 && (
          <span className="ml-auto rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-semibold">
            {history.length}
          </span>
        )}
      </div>
      {history.length > 0 && (
        <div className="px-3 py-2 border-b border-border/50">
          <button
            onClick={() => downloadSessionReport(history)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1.5 text-xs font-semibold transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-2">
            No words yet. Submit a spelling to start your history.
          </p>
        ) : (
          items.map(({ entry, originalIndex }) => {
            const correct = entry.result.correctness?.isCorrect;
            const isActive = originalIndex === activeIndex;
            return (
              <button
                key={originalIndex}
                onClick={() => onSelect(originalIndex)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                  isActive
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/50 bg-card/40 hover:bg-accent/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    correct ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                  )}
                >
                  {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{entry.word.word}</p>
                  {!correct && entry.attempt && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      You: <span className="line-through">{entry.attempt}</span>
                    </p>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">#{originalIndex + 1}</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
