import { afterEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: client.createClient }));

describe("Supabase configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("creates the configured client and returns its access token", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
    client.getSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
    client.createClient.mockReturnValue({ auth: { getSession: client.getSession } });
    const module = await import("@/lib/supabase");
    expect(module.supabaseConfigured).toBe(true);
    await expect(module.getAccessToken()).resolves.toBe("token-1");
    expect(client.createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "public-key",
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" }) }),
    );
  });

  it("returns null when a configured session is absent", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
    client.getSession.mockResolvedValue({ data: { session: null } });
    client.createClient.mockReturnValue({ auth: { getSession: client.getSession } });
    const module = await import("@/lib/supabase");
    await expect(module.getAccessToken()).resolves.toBeNull();
  });

  it("warns, uses placeholders, and avoids auth calls when configuration is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", undefined);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    client.createClient.mockReturnValue({ auth: { getSession: client.getSession } });
    const module = await import("@/lib/supabase");
    expect(module.supabaseConfigured).toBe(false);
    await expect(module.getAccessToken()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("auth features disabled"));
    expect(client.createClient).toHaveBeenCalledWith(
      "https://placeholder.supabase.co",
      "placeholder-anon-key",
      expect.any(Object),
    );
    expect(client.getSession).not.toHaveBeenCalled();
  });
});
