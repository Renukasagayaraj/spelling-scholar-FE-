import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authCallback: undefined as undefined | ((event: string, session: unknown) => void),
  unsubscribe: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  invalidateCustomListsCache: vi.fn(),
  fetchSubscriptionStatus: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        mocks.authCallback = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      }),
      getSession: mocks.getSession,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  },
}));

vi.mock("@/lib/api", () => ({
  invalidateCustomListsCache: mocks.invalidateCustomListsCache,
  fetchSubscriptionStatus: mocks.fetchSubscriptionStatus,
}));

import { AuthProvider, useAuth } from "@/hooks/use-auth";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authCallback = undefined;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({ error: null });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue(undefined);
    mocks.fetchSubscriptionStatus.mockResolvedValue({ subscribed: true, currentPeriodEnd: 123, cancelAtPeriodEnd: true });
  });

  afterEach(() => vi.restoreAllMocks());

  it("requires consumers to be inside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within an AuthProvider");
    consoleError.mockRestore();
  });

  it("loads the existing session, responds to auth changes, and cleans up", async () => {
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();

    const user = { id: "user-1", email: "learner@example.com" };
    const session = { user, access_token: "token" };
    await act(async () => mocks.authCallback?.("SIGNED_IN", session));
    await waitFor(() => expect(result.current.user).toEqual(user));
    await waitFor(() => expect(result.current.subscribed).toBe(true));
    expect(result.current).toMatchObject({ currentPeriodEnd: 123, cancelAtPeriodEnd: true, checkingSubscription: false });
    expect(mocks.invalidateCustomListsCache).toHaveBeenCalled();

    await act(async () => mocks.authCallback?.("SIGNED_OUT", null));
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.subscribed).toBe(false);
    expect(result.current.currentPeriodEnd).toBeNull();

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it("delegates password, signup, OAuth, and sign-out actions", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ error: { message: "bad password" } });
    mocks.signUp.mockResolvedValueOnce({ error: { message: "already exists" } });
    mocks.signInWithOAuth.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "facebook unavailable" } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.signInWithPassword("a@b.com", "pw")).resolves.toEqual({ error: "bad password" });
    await expect(result.current.signUpWithPassword("a@b.com", "pw")).resolves.toEqual({ error: "already exists" });
    await expect(result.current.signInWithGoogle()).resolves.toEqual({ error: null });
    await expect(result.current.signInWithFacebook()).resolves.toEqual({ error: "facebook unavailable" });
    await result.current.signOut();

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "pw" });
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "a@b.com", password: "pw", options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    }));
    expect(mocks.signInWithOAuth).toHaveBeenNthCalledWith(1, { provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    expect(mocks.signInWithOAuth).toHaveBeenNthCalledWith(2, { provider: "facebook", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("resets subscription state when refresh fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const user = { id: "user-2" };
    await act(async () => mocks.authCallback?.("SIGNED_IN", { user, access_token: "token" }));
    await waitFor(() => expect(result.current.subscribed).toBe(true));

    mocks.fetchSubscriptionStatus.mockRejectedValueOnce(new Error("offline"));
    await act(async () => result.current.refreshSubscription());
    expect(result.current).toMatchObject({ subscribed: false, currentPeriodEnd: null, cancelAtPeriodEnd: false, checkingSubscription: false });
    expect(consoleError).toHaveBeenCalledWith("Failed to check subscription status:", expect.any(Error));
  });
});
