import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock3, Loader2, X } from "lucide-react";
import { formatSessionModeLabel } from "@/lib/sessionResume";

interface ActiveSessionConflictDialogProps {
  open: boolean;
  activeMode: string | null;
  requestedMode: string | null;
  loadingState: "resume" | "startNew" | null;
  error: string | null;
  onResume: () => void | Promise<void>;
  onStartNew: () => void | Promise<void>;
  onCancel: () => void;
}

export function ActiveSessionConflictDialog({
  open,
  activeMode,
  requestedMode,
  loadingState,
  error,
  onResume,
  onStartNew,
  onCancel,
}: ActiveSessionConflictDialogProps) {
  const activeLabel = activeMode ? formatSessionModeLabel(activeMode) : "another session";
  const requestedLabel = requestedMode ? formatSessionModeLabel(requestedMode) : "this session";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg gap-5 overflow-y-auto rounded-2xl border-border/70 p-5 shadow-2xl sm:p-6">
        <AlertDialogCancel
          onClick={onCancel}
          disabled={loadingState !== null}
          className="absolute right-3 top-3 mt-0 h-9 w-9 rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-4 sm:top-4"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </AlertDialogCancel>

        <AlertDialogHeader className="flex-row items-start space-x-3 space-y-0 pr-8 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <AlertDialogTitle>Active Session In Progress</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              You already have an active session in {activeLabel}. Continue that session, or end
              it and start {requestedLabel}.
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onResume();
            }}
            disabled={loadingState !== null}
            className="h-11 w-full bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90"
          >
            {loadingState === "resume" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Resume Current Session
          </AlertDialogAction>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onStartNew();
            }}
            disabled={loadingState !== null}
            className="h-11 w-full shadow-sm"
          >
            {loadingState === "startNew" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Stop Current And Start New
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
