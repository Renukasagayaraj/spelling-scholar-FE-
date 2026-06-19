import { useRef, useState, useCallback, useEffect } from "react";
import { useAuth } from "./use-auth";

const STORAGE_KEY = "spelling-coach-sound-enabled";

export function useCheer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { profile, updateProfile } = useAuth();

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

  // Sync sound setting from database profile when loaded
  useEffect(() => {
    if (profile && profile.audio_enabled !== undefined && profile.audio_enabled !== null) {
      setSoundEnabled(profile.audio_enabled);
    }
  }, [profile?.audio_enabled]);

  const playCheer = useCallback(() => {
    if (!soundEnabled || !audioRef.current) return;
    const a = audioRef.current;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [soundEnabled]);

  const toggleSound = useCallback(async () => {
    setSoundEnabled((v) => {
      const next = !v;
      updateProfile({ audio_enabled: next }).catch(console.error);
      return next;
    });
  }, [updateProfile]);

  return { soundEnabled, toggleSound, playCheer };
}

