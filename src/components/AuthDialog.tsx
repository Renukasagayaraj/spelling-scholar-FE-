import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, signInWithFacebook } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    reset();
    setBusy(true);
    const fn = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const { error: err } = await fn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === "signup") {
      setInfo("Check your email to confirm your account, then sign in.");
    } else {
      onOpenChange(false);
    }
  };

  const handleGoogle = async () => {
    reset();
    setBusy(true);
    const { error: err } = await signInWithGoogle();
    setBusy(false);
    if (err) setError(err);
  };

  const handleFacebook = async () => {
    reset();
    setBusy(true);
    const { error: err } = await signInWithFacebook();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Sign in" : "Create account"}</DialogTitle>
          <DialogDescription>
            Sign in to manage and practice your custom word lists.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <GoogleIcon /> Continue with Google
          </button>

          <button
            type="button"
            onClick={handleFacebook}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            <FacebookIcon /> Continue with Facebook
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-success">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            reset();
          }}
          className="text-xs text-muted-foreground hover:text-foreground text-center"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.5 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.5 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.4 35.6 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.09 4.388 23.092 10.125 24v-8.486H7.078v-3.44h3.047V9.412c0-3.016 1.792-4.68 4.533-4.68 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.953.925-1.953 1.873v2.25h3.328l-.532 3.44h-2.796V24C19.612 23.092 24 18.09 24 12.073z" />
    </svg>
  );
}
