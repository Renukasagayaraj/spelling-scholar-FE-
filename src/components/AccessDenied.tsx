import { UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/** Shown for account-only pages when the visitor has no active session. */
export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fcfbf7] dark:bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border/60 rounded-2xl p-8 shadow-xl text-center space-y-6"
      >
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
          <UserRound className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-[#1e3a5f]">Access Denied</h2>
          <p className="text-muted-foreground text-sm">Please sign in to access your account and manage preferences.</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-[0.98]"
        >
          Go to Home page to Sign In
        </button>
      </motion.div>
    </div>
  );
}
