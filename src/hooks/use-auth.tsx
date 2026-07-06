import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { invalidateCustomListsCache, fetchSubscriptionStatus } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  subscribed: boolean;
  checkingSubscription: boolean;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  refreshSubscription: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithFacebook: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<number | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setSubscribed(false);
      setCurrentPeriodEnd(null);
      setCancelAtPeriodEnd(false);
      return;
    }
    setCheckingSubscription(true);
    try {
      const res = await fetchSubscriptionStatus();
      setSubscribed(res.subscribed);
      setCurrentPeriodEnd(res.currentPeriodEnd ?? null);
      setCancelAtPeriodEnd(!!res.cancelAtPeriodEnd);
    } catch (err) {
      console.error("Failed to check subscription status:", err);
      setSubscribed(false);
      setCurrentPeriodEnd(null);
      setCancelAtPeriodEnd(false);
    } finally {
      setCheckingSubscription(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setSubscribed(false);
      setCurrentPeriodEnd(null);
      setCancelAtPeriodEnd(false);
    }
  }, [user, refreshSubscription]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    // Strip OAuth tokens from the URL hash so they aren't visible/shareable.
    // Supabase's detectSessionInUrl parses them, but we clean the address bar.
    const scrubAuthHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      if (hash && /[#&](access_token|refresh_token|provider_token|error_description)=/.test(hash)) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", cleanUrl);
      }
    };

    // 1. Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      invalidateCustomListsCache();
      setSession(newSession);
      setUser(newSession?.user ?? null);
      scrubAuthHash();
    });
    // 2. Then fetch existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      scrubAuthHash();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    configured: supabaseConfigured,
    subscribed,
    checkingSubscription,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    refreshSubscription,
    signInWithPassword: async (email, password) => {
      if (!supabaseConfigured) return { error: "Auth is not configured. Please contact support." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUpWithPassword: async (email, password) => {
      if (!supabaseConfigured) return { error: "Auth is not configured. Please contact support." };
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    },
    signInWithGoogle: async () => {
      if (!supabaseConfigured) return { error: "Auth is not configured. Please contact support." };
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    },
    signInWithFacebook: async () => {
      if (!supabaseConfigured) return { error: "Auth is not configured. Please contact support." };
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      if (!supabaseConfigured) return;
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
