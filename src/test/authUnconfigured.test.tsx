import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigured: false,
  supabase: { auth },
}));
vi.mock("@/lib/api", () => ({ invalidateCustomListsCache: vi.fn(), fetchSubscriptionStatus: vi.fn() }));

import { AuthProvider, useAuth } from "@/hooks/use-auth";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("unconfigured authentication", () => {
  it("disables every external auth operation and keeps subscription state empty", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toMatchObject({ configured: false, loading: false, user: null, subscribed: false });
    const expected = { error: "Auth is not configured. Please contact support." };
    await expect(result.current.signInWithPassword("a", "b")).resolves.toEqual(expected);
    await expect(result.current.signUpWithPassword("a", "b")).resolves.toEqual(expected);
    await expect(result.current.signInWithGoogle()).resolves.toEqual(expected);
    await expect(result.current.signInWithFacebook()).resolves.toEqual(expected);
    await act(async () => result.current.refreshSubscription());
    await result.current.signOut();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
