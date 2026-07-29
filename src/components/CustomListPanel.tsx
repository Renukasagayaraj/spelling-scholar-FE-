import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Upload, FileUp, List, Check, ChevronDown, ChevronRight, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCustomLists, importCustomWordList, importCustomWordFile, fetchCustomListWords, UnauthorizedError } from "@/lib/api";
import type { CustomListSummary, ImportCustomListResponse, WordData } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/AuthDialog";

interface CustomListPanelProps {
  selectedList: CustomListSummary | null;
  onSelectList: (list: CustomListSummary | null) => void;
  onStartPractice: () => void;
}

export function CustomListPanel({ selectedList, onSelectList, onStartPractice }: CustomListPanelProps) {
  const { user, loading: authLoading, configured } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const [lists, setLists] = useState<CustomListSummary[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);

  const [listName, setListName] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportCustomListResponse | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [fileImporting, setFileImporting] = useState(false);
  const [fileImportError, setFileImportError] = useState<string | null>(null);
  const [fileImportResult, setFileImportResult] = useState<ImportCustomListResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileImportAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => { fileImportAbortRef.current?.abort(); }, []);

  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [listWordsMap, setListWordsMap] = useState<Record<string, WordData[]>>({});
  const [wordsLoadingId, setWordsLoadingId] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    if (!user) return;
    setListsLoading(true);
    setListsError(null);
    try {
      const data = await fetchCustomLists();
      setLists(data.lists || []);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setListsError("Your session expired. Please sign in again.");
      } else {
        setListsError("Could not load custom lists.");
      }
    } finally {
      setListsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const handleToggleExpand = async (list: CustomListSummary) => {
    if (expandedListId === list.id) {
      setExpandedListId(null);
      return;
    }
    setExpandedListId(list.id);
    // Also select the list
    onSelectList(list);
    // Load words if not cached
    if (!listWordsMap[list.id]) {
      setWordsLoadingId(list.id);
      try {
        const result = await fetchCustomListWords(list.id);
        // Handle both array response and { words: [] } response
        const words = Array.isArray(result) ? result : (result as any)?.words || [];
        setListWordsMap(prev => ({ ...prev, [list.id]: words }));
      } catch {
        setListWordsMap(prev => ({ ...prev, [list.id]: [] }));
      } finally {
        setWordsLoadingId(null);
      }
    }
  };

  const handleImport = async () => {
    if (!listName.trim() || !wordsText.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const words = wordsText
        .split(/[\n,]+/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
      if (words.length === 0) { setImportError("No valid words found."); setImporting(false); return; }
      const res = await importCustomWordList({
        listName: listName.trim(),
        words,
        overwriteList: true,
      });
      setImportResult(res);
      setListName("");
      setWordsText("");
      loadLists();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setImportError("Your session expired. Please sign in again.");
      } else {
        setImportError("Import failed. Please try again.");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;

    setFileImportError(null);
    setFileImportResult(null);
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const allowedContentTypes = extension === ".txt"
      ? new Set(["", "text/plain", "application/octet-stream"])
      : new Set(["", "text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"]);
    if ((extension !== ".txt" && extension !== ".csv") || !allowedContentTypes.has(file.type.toLowerCase())) {
      setFileImportError("Unsupported file type. Please select a .txt or .csv file.");
      return;
    }

    fileImportAbortRef.current?.abort();
    const controller = new AbortController();
    fileImportAbortRef.current = controller;

    setFileImporting(true);
    try {
      const result = await importCustomWordFile(file, { signal: controller.signal });
      setFileImportResult(result);
      await loadLists();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof UnauthorizedError) {
        setFileImportError("Your session expired. Please sign in again.");
      } else {
        setFileImportError(e instanceof Error ? e.message : "File import failed. Please try again.");
      }
    } finally {
      setFileImporting(false);
    }
  };

  if (configured && !authLoading && !user) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
          <List className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-sm text-foreground font-medium">
            Sign in to view and practice your custom lists.
          </p>
          <button
            onClick={() => setAuthOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        </div>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <List className="h-4 w-4" /> Your Word Lists
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowImport((v) => !v); setImportResult(null); }}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            <Upload className="h-3 w-3" /> {showImport ? "Hide Import" : "Import New List"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFileImportError(null);
              setFileImportResult(null);
              fileInputRef.current?.click();
            }}
            disabled={fileImporting}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fileImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}
            {fileImporting ? "Importing…" : "Import File"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            aria-label="Choose word list file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void handleFileSelected(file);
            }}
          />
        </div>
      </div>

      {fileImportError && (
        <p role="alert" className="text-xs text-destructive text-right">{fileImportError}</p>
      )}
      {fileImportResult && (
        <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-xs text-center space-y-0.5">
          <p className="font-semibold text-success">✓ File imported as "{fileImportResult.list.name}"</p>
          <p className="text-muted-foreground">{fileImportResult.importedCount} imported · {fileImportResult.skippedExistingCount} skipped</p>
        </div>
      )}

      {listsLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      {listsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center space-y-2">
          <p className="text-xs text-destructive">{listsError}</p>
          {listsError.toLowerCase().includes("session") ? (
            <button
              onClick={() => setAuthOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <LogIn className="h-3 w-3" /> Sign in again
            </button>
          ) : (
            <button onClick={loadLists} className="text-xs text-primary hover:underline">
              Retry
            </button>
          )}
        </div>
      )}
      <AuthDialog open={authOpen} onOpenChange={(o) => { setAuthOpen(o); if (!o) loadLists(); }} />

      {!listsLoading && lists.length === 0 && !listsError && (
        <p className="text-xs text-muted-foreground text-center py-4">No custom lists yet. Import one to get started.</p>
      )}

      {/* List items with inline expand */}
      {lists.length > 0 && (
        <div className="space-y-2">
          {lists.map((list) => {
            const isSelected = selectedList?.id === list.id;
            const isExpanded = expandedListId === list.id;
            const words = listWordsMap[list.id] || [];
            const isLoadingWords = wordsLoadingId === list.id;

            return (
              <div
                key={list.id}
                className={cn(
                  "rounded-xl border transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-card"
                )}
              >
                {/* List header row */}
                <button
                  onClick={() => handleToggleExpand(list)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{list.name}</p>
                    <p className="text-[11px] text-muted-foreground">{list.wordCount} words</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>

                {/* Expanded words section */}
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-3">
                    <div className="border-t border-dashed border-border pt-3">
                      {isLoadingWords ? (
                        <div className="flex justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      ) : words.length > 0 ? (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1.5">
                            Showing {words.length} of {list.wordCount}
                          </p>
                          <p className="text-sm text-foreground">
                            {words.map(w => w.word).join(", ")}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center">No words found.</p>
                      )}
                    </div>

                    <button
                      onClick={onStartPractice}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      Practice "{list.name}"
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Import Form */}
      {showImport && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Import a Word List</h4>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">List Name</label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="e.g. Wind Words"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Words (one per line or comma-separated)</label>
            <textarea
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              rows={4}
              placeholder={"zephyrette\nmoonbow\nwhirlwind"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={handleImport}
            disabled={importing || !listName.trim() || !wordsText.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importing…" : "Import List"}
          </button>

          {importError && <p className="text-xs text-destructive text-center">{importError}</p>}

          {importResult && (
            <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-xs text-center space-y-0.5">
              <p className="font-semibold text-success">✓ List "{importResult.list.name}" imported</p>
              <p className="text-muted-foreground">{importResult.importedCount} imported · {importResult.skippedExistingCount} skipped</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
