import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, BookOpen, Globe, Tag, Sparkles, Shapes, BookText, Volume2, Layers } from "lucide-react";
import {
  searchWords,
  fetchWordDetail,
  type WordSearchMode,
  type WordSearchResult,
  type WordDetail,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TeachingCard, ConceptTeachingContent } from "./TeachingCard";
import { MatchedPatternChips } from "./MatchedPatternChips";
import { LabelChips } from "./LabelChips";

export function WordSearchSidebar() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<WordSearchMode>("startsWith");
  const [results, setResults] = useState<WordSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<WordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await searchWords(q, mode, 10);
        setResults(data.results || []);
        setError(null);
        setOpen(true);
      } catch {
        setError("Search failed.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const openWord = useCallback(async (word: string) => {
    setOpen(false);
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const d = await fetchWordDetail(word);
      setDetail(d);
    } catch {
      setDetailError("Could not load word details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return (
    <aside
      ref={wrapperRef}
      className="hidden xl:flex flex-col fixed right-4 top-24 w-72 max-h-[calc(100vh-7rem)] rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Search className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Word Search</h2>
      </div>

      <div className="p-3 space-y-2 border-b border-border/50">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            placeholder="Search a word…"
            className="flex-1 bg-transparent outline-none text-xs placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setOpen(false);
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 text-[10px]">
          {(["startsWith", "contains"] as WordSearchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 px-2 py-1 rounded-md font-medium transition-colors",
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "startsWith" ? "starts" : "contains"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {error && <p className="text-xs text-destructive px-2 py-1">{error}</p>}
        {!error && results.length === 0 && !loading && query.trim().length >= 2 && (
          <p className="text-xs text-muted-foreground text-center py-6 px-2">
            No matches for “{query.trim()}”.
          </p>
        )}
        {!error && results.length === 0 && query.trim().length < 2 && (
          <p className="text-xs text-muted-foreground text-center py-6 px-2">
            Type at least 2 letters to search.
          </p>
        )}
        {results.map((r) => (
          <button
            key={r.word}
            onClick={() => openWord(r.word)}
            className="w-full flex flex-col gap-0.5 rounded-lg border border-border/50 bg-card/40 hover:bg-accent/40 px-2.5 py-2 text-left transition-colors"
          >
            <span className="text-xs font-semibold text-foreground truncate">{r.word}</span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-chip px-1.5 py-0.5 text-chip-foreground">L{r.level}</span>
              <span className="truncate">{r.origin}</span>
              <span className="italic shrink-0">{r.partOfSpeech}</span>
            </span>
          </button>
        ))}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">
              {detail?.word || (detailLoading ? "Loading…" : "Word")}
            </DialogTitle>
          </DialogHeader>

          {detailLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {detailError && <p className="text-sm text-destructive">{detailError}</p>}

          {detail && !detailLoading && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-medium text-chip-foreground">
                  Level {detail.level}
                </span>
                {detail.gradeBand && (
                  <span className="rounded-full bg-chip-accent px-2.5 py-1 text-xs font-medium text-chip-accent-foreground">
                    Grade {detail.gradeBand}
                  </span>
                )}
                {detail.difficulty && (
                  <span className="rounded-full bg-chip-warm px-2.5 py-1 text-xs font-medium text-chip-warm-foreground">
                    {detail.difficulty}
                  </span>
                )}
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground italic">
                  {detail.partOfSpeech}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="leading-relaxed">{detail.definition}</p>
              </div>

              {detail.exampleSentence && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm italic text-foreground/80">
                  “{detail.exampleSentence}”
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span>Origin: <span className="text-foreground font-medium">{detail.origin}</span></span>
              </div>

              {detail.wordBreakdown?.displayChunks?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                    Chunks
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {detail.wordBreakdown.displayChunks.map((c, i) => (
                      <span
                        key={i}
                        className="rounded-lg bg-primary/10 text-primary px-2.5 py-1 font-mono text-sm font-bold tracking-widest"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  {detail.wordBreakdown.chunkReason && (
                    <p className="text-xs text-muted-foreground mt-1.5">{detail.wordBreakdown.chunkReason}</p>
                  )}
                </div>
              ) : null}

              {/* Teach The Word */}
              {(() => {
                const matched = detail.wordBreakdown?.matchedPatterns ?? [];
                const conceptPatterns = detail.conceptLabels?.patternLabels ?? [];
                const sayAloud = detail.phonemeMetadata?.sayAloudTip;
                const relatedForms = detail.wordTeaching?.conceptTeaching?.relatedForms ?? [];
                const conceptData = {
                  summary: detail.wordTeaching?.conceptTeaching?.summary ?? "",
                  meaningFocus: detail.wordTeaching?.conceptTeaching?.meaningFocus ?? "",
                  originFocus: detail.wordTeaching?.conceptTeaching?.originFocus ?? "",
                  morphologyFocus: detail.wordTeaching?.conceptTeaching?.morphologyFocus ?? "",
                  originLabels:
                    detail.wordTeaching?.conceptTeaching?.originLabels ??
                    detail.conceptLabels?.originLabels ??
                    [],
                  morphologyLabels:
                    detail.wordTeaching?.conceptTeaching?.morphologyLabels ??
                    detail.conceptLabels?.morphologyLabels ??
                    [],
                  relatedForms,
                };
                const hasForm = matched.length > 0 || conceptPatterns.length > 0 || !!sayAloud || relatedForms.length > 0;
                const hasConcept =
                  !!conceptData.summary ||
                  conceptData.originLabels.length > 0 ||
                  conceptData.morphologyLabels.length > 0;
                if (!hasForm && !hasConcept) return null;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Teach The Word</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <TeachingCard title="Form Teaching" icon={<Shapes className="h-4 w-4 text-primary" />}>
                        {hasForm ? (
                          <div className="space-y-2.5">
                            {matched.length > 0 && (
                              <MatchedPatternChips patterns={matched} title="Patterns" />
                            )}
                            {conceptPatterns.length > 0 && (
                              <LabelChips labels={conceptPatterns} variant="default" title="Concept Labels" />
                            )}
                            {relatedForms.length > 0 && (
                              <LabelChips labels={relatedForms} variant="accent" title="Related Forms" />
                            )}
                            {sayAloud && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                                  Say Aloud Tip
                                </p>
                                <p>{sayAloud}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-muted-foreground italic text-xs">No matched patterns for this word.</p>
                        )}
                      </TeachingCard>
                      <TeachingCard title="Concept Teaching" icon={<BookText className="h-4 w-4 text-primary" />}>
                        <ConceptTeachingContent data={conceptData} />
                      </TeachingCard>
                    </div>
                  </div>
                );
              })()}

              {/* Say It Aloud */}
              {(detail.phonemeMetadata?.friendlyChunks?.length || detail.phonemeMetadata?.sayAloudTip) && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Say It Aloud</h3>
                  </div>
                  {detail.phonemeMetadata?.friendlyChunks?.length ? (
                    <p className="font-mono text-base font-semibold tracking-wide">
                      {detail.phonemeMetadata.friendlyChunks.join("-")}
                    </p>
                  ) : null}
                  {detail.phonemeMetadata?.sayAloudTip && (
                    <p className="text-xs text-muted-foreground mt-1">{detail.phonemeMetadata.sayAloudTip}</p>
                  )}
                </div>
              )}

              {detail.phonemeMetadata?.trickyParts?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                    Tricky parts
                  </p>
                  <ul className="space-y-1">
                    {detail.phonemeMetadata.trickyParts.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Tag className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        <span>
                          <span className="font-mono font-bold">{t.text}</span>
                          {t.label && <span className="text-muted-foreground"> — {t.label}</span>}
                          {t.reason && <span className="block text-muted-foreground">{t.reason}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}
