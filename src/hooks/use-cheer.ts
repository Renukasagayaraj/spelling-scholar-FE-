import { useRef, useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "spelling-coach-sound-enabled";

export function useCheer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const a = new Audio("/cheer.mp3");
    a.preload = "auto";
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(soundEnabled)); } catch {}
  }, [soundEnabled]);

  const playCheer = useCallback(() => {
    if (!soundEnabled || !audioRef.current) return;
    const a = audioRef.current;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [soundEnabled]);

  const toggleSound = useCallback(() => setSoundEnabled((v) => !v), []);

  return { soundEnabled, toggleSound, playCheer };
}
