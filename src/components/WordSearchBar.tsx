import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, BookOpen, Globe, Tag, Sparkles } from "lucide-react";
import {
  searchWords,
  fetchWordDetail,
  type WordSearchMode,
  type WordSearchResult,
  type WordDetail,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function WordSearchBar() {
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
    <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto mb-6">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search any word (e.g. dent, frice)…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
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
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 text-xs shrink-0">
          {(["startsWith", "contains"] as WordSearchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-2 py-1 rounded-md font-medium transition-colors",
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "startsWith" ? "starts" : "contains"}
            </button>
          ))}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
      </div>

      {open && (results.length > 0 || error || (!loading && query.trim().length >= 2)) && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {error && <p className="px-4 py-3 text-sm text-destructive">{error}</p>}
          {!error && results.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No matches for “{query.trim()}”.</p>
          )}
          <ul className="max-h-80 overflow-y-auto divide-y divide-border">
            {results.map((r) => (
              <li key={r.word}>
                <button
                  onClick={() => openWord(r.word)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-accent/40 transition-colors"
                >
                  <span className="font-semibold text-sm">{r.word}</span>
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-chip px-2 py-0.5 text-chip-foreground">L{r.level}</span>
                    <span>{r.origin}</span>
                    <span className="italic">{r.partOfSpeech}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
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

              {detail.phonemeMetadata?.friendlyChunks?.length ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Say it aloud
                  </p>
                  <p className="font-mono text-sm">
                    {detail.phonemeMetadata.friendlyChunks.join("-")}
                  </p>
                  {detail.phonemeMetadata.sayAloudTip && (
                    <p className="text-xs text-muted-foreground mt-1">{detail.phonemeMetadata.sayAloudTip}</p>
                  )}
                </div>
              ) : null}

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

              {detail.wordTeaching?.conceptTeaching?.summary && (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground/85 leading-relaxed">
                  {detail.wordTeaching.conceptTeaching.summary}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
