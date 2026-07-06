import { useState, useEffect, useCallback } from "react";
import { Loader2, Globe, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchForeignOrigins, fetchForeignOriginDetails } from "@/lib/api";
import type { ForeignOriginSummary, ForeignOriginDetail } from "@/lib/api";

interface ForeignOriginPanelProps {
  selectedOrigin: ForeignOriginSummary | null;
  onSelectOrigin: (origin: ForeignOriginSummary | null) => void;
  onDetailsLoaded?: (details: ForeignOriginDetail | null) => void;
  onStartPractice: () => void;
}

export function ForeignOriginPanel({
  selectedOrigin,
  onSelectOrigin,
  onDetailsLoaded,
  onStartPractice,
}: ForeignOriginPanelProps) {
  const [origins, setOrigins] = useState<ForeignOriginSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(null);
  const [detailsMap, setDetailsMap] = useState<Record<string, ForeignOriginDetail>>({});
  const [detailsLoadingFor, setDetailsLoadingFor] = useState<string | null>(null);

  const loadOrigins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchForeignOrigins();
      setOrigins(data.origins || []);
    } catch {
      setError("Could not load language origins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrigins();
  }, [loadOrigins]);

  const handleToggleExpand = async (o: ForeignOriginSummary) => {
    onSelectOrigin(o);
    if (expandedOrigin === o.origin) {
      setExpandedOrigin(null);
      return;
    }
    setExpandedOrigin(o.origin);
    if (!detailsMap[o.origin]) {
      setDetailsLoadingFor(o.origin);
      try {
        const details = await fetchForeignOriginDetails(o.origin);
        setDetailsMap((prev) => ({ ...prev, [o.origin]: details }));
        onDetailsLoaded?.(details);
      } catch {
        // swallow — preview is optional
      } finally {
        setDetailsLoadingFor(null);
      }
    } else {
      onDetailsLoaded?.(detailsMap[o.origin]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Globe className="h-4 w-4" /> Words by Language Origin
        </h3>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      {!loading && origins.length === 0 && !error && (
        <p className="text-xs text-muted-foreground text-center py-4">No origins available.</p>
      )}

      {origins.length > 0 && (
        <div className="space-y-2">
          {origins.map((o) => {
            const isSelected = selectedOrigin?.origin === o.origin;
            const isExpanded = expandedOrigin === o.origin;
            const details = detailsMap[o.origin];
            const isLoadingDetails = detailsLoadingFor === o.origin;

            return (
              <div
                key={o.origin}
                className={cn(
                  "rounded-xl border transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card"
                )}
              >
                <button
                  onClick={() => handleToggleExpand(o)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{o.origin}</p>
                    <p className="text-[11px] text-muted-foreground">{o.wordCount} words</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-3">
                    <div className="border-t border-dashed border-border pt-3">
                      {isLoadingDetails ? (
                        <div className="flex justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      ) : details && details.words?.length > 0 ? (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1.5">
                            Preview: {Math.min(15, details.words.length)} of {details.wordCount}
                          </p>
                          <p className="text-sm text-foreground">
                            {details.words.slice(0, 15).map((w) => w.word).join(", ")}
                            {details.words.length > 15 ? "…" : ""}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center">No preview available.</p>
                      )}
                    </div>

                    <button
                      onClick={onStartPractice}
                      disabled={o.wordCount === 0}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Start {o.origin} Practice
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
