import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function readCallbackParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return {
    code: search.get("code"),
    error:
      search.get("error_description") ??
      search.get("error") ??
      hash.get("error_description") ??
      hash.get("error"),
  };
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const exchangeStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    const { code, error: callbackError } = readCallbackParams();

    // Remove the one-time code/error from the address bar as soon as it is read.
    window.history.replaceState(null, "", window.location.pathname);

    if (!supabaseConfigured) {
      setError("Authentication is not configured. Please contact support.");
      return;
    }

    if (callbackError) {
      setError(callbackError);
      return;
    }

    if (!code) {
      setError("The sign-in callback is missing its authorization code. Please try again.");
      return;
    }

    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      navigate("/", { replace: true });
    });
  }, [navigate]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Sign-in could not be completed</h1>
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
          <Link className="mt-5 inline-block text-sm font-medium text-primary hover:underline" to="/">
            Return home and try again
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" />
        Completing sign-in…
      </div>
    </main>
  );
}
