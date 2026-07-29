import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BADGES, useRewards } from "@/hooks/use-rewards";
import { useCheer } from "@/hooks/use-cheer";
import { useIsMobile } from "@/hooks/use-mobile";
import { reducer, toast, useToast } from "@/hooks/use-toast";

describe("useIsMobile", () => {
  it("tracks viewport changes and removes its listener", () => {
    let change: (() => void) | undefined;
    const addEventListener = vi.fn((_name, handler: () => void) => { change = handler; });
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ addEventListener, removeEventListener })),
    });

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");

    act(() => {
      window.innerWidth = 900;
      change?.();
    });
    expect(result.current).toBe(false);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", change);
  });
});

describe("useCheer", () => {
  const audio = {
    preload: "",
    currentTime: 9,
    src: "/cheer.mp3",
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal("Audio", vi.fn(() => audio));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("defaults to enabled, persists toggles, plays, and cleans up audio", () => {
    const { result, unmount } = renderHook(() => useCheer());
    expect(result.current.soundEnabled).toBe(true);
    act(() => result.current.playCheer());
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalled();

    act(() => result.current.toggleSound());
    expect(result.current.soundEnabled).toBe(false);
    expect(localStorage.getItem("spelling-coach-sound-enabled")).toBe("false");
    audio.play.mockClear();
    act(() => result.current.playCheer());
    expect(audio.play).not.toHaveBeenCalled();

    unmount();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.src).toBe("");
  });

  it("loads disabled state and absorbs rejected playback", async () => {
    localStorage.setItem("spelling-coach-sound-enabled", "false");
    audio.play.mockRejectedValueOnce(new Error("autoplay blocked"));
    const { result } = renderHook(() => useCheer());
    expect(result.current.soundEnabled).toBe(false);
    act(() => result.current.toggleSound());
    act(() => result.current.playCheer());
    await Promise.resolve();
    expect(audio.play).toHaveBeenCalled();
  });

  it("continues with in-memory state when local storage is unavailable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    const { result } = renderHook(() => useCheer());
    expect(result.current.soundEnabled).toBe(true);
    act(() => result.current.toggleSound());
    expect(result.current.soundEnabled).toBe(false);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("useRewards", () => {
  const oscillator = {
    type: "sine",
    frequency: { value: 0 },
    connect: vi.fn(() => gain),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(() => oscillator),
  };
  const audioContext = {
    currentTime: 10,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: vi.fn(() => audioContext) });
  });

  it("returns empty stats and records correct, incorrect, badge, and milestone transitions", () => {
    const { result } = renderHook(() => useRewards());
    expect(result.current.getStats(2)).toEqual({ streak: 0, bestStreak: 0, totalCorrect: 0, badges: [] });

    act(() => {
      result.current.recordCorrect(2);
      result.current.recordCorrect(2);
      result.current.recordCorrect(2);
    });
    expect(result.current.getStats(2)).toMatchObject({ streak: 3, bestStreak: 3, totalCorrect: 3, badges: ["streak3"] });
    expect(result.current.newBadge?.id).toBe("streak3");
    expect(result.current.milestoneHit).toBe(3);
    expect(audioContext.createOscillator).toHaveBeenCalledTimes(4);

    act(() => {
      result.current.clearNewBadge();
      result.current.clearMilestone();
      result.current.recordIncorrect(2);
    });
    expect(result.current.newBadge).toBeNull();
    expect(result.current.milestoneHit).toBeNull();
    expect(result.current.getStats(2).streak).toBe(0);
    expect(result.current.getStats(2).bestStreak).toBe(3);
    expect(JSON.parse(localStorage.getItem("spelling-coach-rewards-v1") ?? "{}")[2]).toBeDefined();
  });

  it("loads saved state and tolerates malformed storage", () => {
    localStorage.setItem("spelling-coach-rewards-v1", JSON.stringify({ 1: { streak: 4, bestStreak: 6, totalCorrect: 20, badges: [] } }));
    const saved = renderHook(() => useRewards());
    expect(saved.result.current.getStats(1).bestStreak).toBe(6);
    saved.unmount();

    localStorage.setItem("spelling-coach-rewards-v1", "not-json");
    const malformed = renderHook(() => useRewards());
    expect(malformed.result.current.getStats(1).totalCorrect).toBe(0);
  });

  it("defines every badge at its exact boundary", () => {
    const stats = { streak: 0, bestStreak: 10, totalCorrect: 50, badges: [] };
    expect(BADGES.every((badge) => badge.check(stats))).toBe(true);
    expect(BADGES.map((badge) => badge.id)).toEqual(["streak3", "streak5", "total25", "streak10", "total50"]);
  });

  it("continues reward updates when browser audio is unavailable", () => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    const { result } = renderHook(() => useRewards());
    act(() => {
      result.current.recordCorrect(1);
      result.current.recordCorrect(1);
      result.current.recordCorrect(1);
    });
    expect(result.current.getStats(1).streak).toBe(3);
  });
});

describe("toast state", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("covers every reducer transition and enforces the one-toast limit", () => {
    const first = { id: "1", title: "first", open: true };
    const second = { id: "2", title: "second", open: true };
    let state = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: first });
    state = reducer(state, { type: "ADD_TOAST", toast: second });
    expect(state.toasts).toEqual([second]);
    state = reducer(state, { type: "UPDATE_TOAST", toast: { id: "2", title: "updated" } });
    expect(state.toasts[0].title).toBe("updated");
    expect(reducer(state, { type: "UPDATE_TOAST", toast: { id: "absent", title: "ignored" } })).toEqual(state);

    const dismissed = reducer(state, { type: "DISMISS_TOAST", toastId: "2" });
    expect(dismissed.toasts[0].open).toBe(false);
    reducer(state, { type: "DISMISS_TOAST", toastId: "2" });
    expect(reducer(state, { type: "REMOVE_TOAST", toastId: "missing" })).toEqual(state);
    expect(reducer(state, { type: "REMOVE_TOAST", toastId: "2" }).toasts).toEqual([]);
    expect(reducer(state, { type: "REMOVE_TOAST" }).toasts).toEqual([]);
  });

  it("creates, updates, dismisses, globally dismisses, and expires toasts", () => {
    const { result } = renderHook(() => useToast());
    let controls!: ReturnType<typeof toast>;
    act(() => { controls = toast({ title: "hello" }); });
    expect(result.current.toasts[0]).toMatchObject({ id: controls.id, title: "hello", open: true });
    act(() => controls.update({ id: "ignored", title: "changed" }));
    expect(result.current.toasts[0].title).toBe("changed");
    act(() => result.current.toasts[0].onOpenChange?.(false));
    expect(result.current.toasts[0].open).toBe(false);
    act(() => result.current.dismiss());
    act(() => vi.advanceTimersByTime(1_000_000));
    expect(result.current.toasts).toEqual([]);
  });
});
