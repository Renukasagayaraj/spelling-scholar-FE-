import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type * as Api from "@/lib/api";

let api: typeof Api;

describe("API local-preview fallbacks", () => {
  beforeAll(async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();
    api = await import("@/lib/api");
    localStorage.clear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:fallback") });
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns mock words and pronunciation after network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api.fetchNextWord({ level: 1, foreignOrigin: "Japanese" })).resolves.toMatchObject({ origin: "Japanese origin (mock)." });
    await expect(api.fetchPronunciationAudio("friend")).resolves.toBe("blob:fallback");
  });

  it("implements subscription, checkout, and portal previews entirely locally", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-17T00:00:00Z"));
    await expect(api.fetchSubscriptionStatus()).resolves.toMatchObject({ subscribed: false, cancelAtPeriodEnd: false });
    await expect(api.createStripeCheckoutSession()).resolves.toEqual({ url: `${window.location.origin}/?payment_success=true` });
    expect(localStorage.getItem("mock_subscribed")).toBe("true");
    await expect(api.fetchSubscriptionStatus()).resolves.toMatchObject({ subscribed: true });
    await expect(api.createStripePortalSession()).resolves.toEqual({ url: window.location.origin });
    vi.useRealTimers();
  });
});
