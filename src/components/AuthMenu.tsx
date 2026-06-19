import { useState } from "react";
import { LogIn, LogOut, User as UserIcon, Loader2, ChevronDown, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/AuthDialog";
import { useNavigate } from "react-router-dom";

export function AuthMenu() {
  const { user, loading, configured, signOut, subscribed } = useAuth();
  const [openAuth, setOpenAuth] = useState(false);
  const navigate = useNavigate();

  // Always render Sign in button, even when Supabase is not yet configured in this environment.

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (user) {
    const label = user.email ?? user.user_metadata?.name ?? "Signed in";
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => navigate("/profile")}
          className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 px-3 py-1.5 rounded-full border border-border/40 transition-all shadow-sm active:scale-95 shrink-0"
          title="View Account Profile"
        >
          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
            {label.charAt(0).toUpperCase()}
          </div>
          <span className="truncate max-w-[120px]">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
        </button>

        {subscribed ? (
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1 text-xs font-bold bg-amber-400 text-amber-950 px-2.5 py-1 rounded-full hover:bg-amber-500 transition-colors shadow-sm"
            title="Premium Subscription Active - View Billing Settings"
          >
            <Sparkles className="h-3 w-3 fill-current" />
            Premium
          </button>
        ) : (
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-1 text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full hover:bg-amber-500 hover:text-white transition-all shadow-sm"
          >
            Upgrade
          </button>
        )}
        <button
          onClick={() => signOut()}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpenAuth(true)}
        className="font-medium px-3 py-1.5 rounded-lg text-foreground hover:text-primary transition-colors text-base"
        title="Sign in"
      >
        Sign in
      </button>
      <AuthDialog open={openAuth} onOpenChange={setOpenAuth} />
    </>
  );
}
