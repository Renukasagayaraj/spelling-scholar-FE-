import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { formatSessionModeLabel } from "@/lib/sessionResume";

interface ActiveSessionConflictDialogProps {
  open: boolean;
  activeMode: string | null;
  requestedMode: string | null;
  loading: boolean;
  error: string | null;
  onResume: () => void | Promise<void>;
  onStartNew: () => void | Promise<void>;
  onCancel: () => void;
}

export function ActiveSessionConflictDialog({
  open,
  activeMode,
  requestedMode,
  loading,
  error,
  onResume,
  onStartNew,
  onCancel,
}: ActiveSessionConflictDialogProps) {
  const activeLabel = activeMode ? formatSessionModeLabel(activeMode) : "another session";
  const requestedLabel = requestedMode ? formatSessionModeLabel(requestedMode) : "this session";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Active Session In Progress</AlertDialogTitle>
          <AlertDialogDescription>
            You already have an active session in {activeLabel}. Do you want to continue that
            session or close it and start {requestedLabel}?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={loading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onResume();
            }}
            disabled={loading}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Resume Current Session
          </AlertDialogAction>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onStartNew();
            }}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Stop Current And Start New
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
