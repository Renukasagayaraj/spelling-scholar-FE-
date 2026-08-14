import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { transcribeAudio, voiceRespond, base64ToBlob, type VoiceRespondResult } from "@/lib/voiceApi";

type VoiceState = "idle" | "listening" | "transcribing" | "processing" | "playing" | "error";

interface VoiceMicProps {
  targetWord: string;
  disabled?: boolean;
  onSpellingAttempt: (parsed: string) => void;
  onSupportResponse?: (result: VoiceRespondResult) => void;
}

const ONBOARDING_KEY = "voice-mic-onboarded";

const stateLabel: Record<VoiceState, string> = {
  idle: "",
  listening: "Listening… (auto-stops when you pause)",
  transcribing: "Transcribing…",
  processing: "Thinking…",
  playing: "Speaking…",
  error: "",
};

export function VoiceMic({ targetWord, disabled, onSpellingAttempt, onSupportResponse }: VoiceMicProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const maxStopTimerRef = useRef<number | null>(null);
  const hasSpokenRef = useRef<boolean>(false);

  const SILENCE_MS = 1400;
  const MAX_RECORD_MS = 10000;
  const SILENCE_RMS = 0.015;

  const stopVad = () => {
    if (vadRafRef.current != null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (maxStopTimerRef.current != null) {
      clearTimeout(maxStopTimerRef.current);
      maxStopTimerRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    silenceStartRef.current = null;
    hasSpokenRef.current = false;
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  useEffect(() => () => {
    stopVad();
    cleanupStream();
    stopPlayback();
  }, []);

  const markOnboarded = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setShowOnboarding(false);
  };

  const handleResult = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      try {
        const transcript = await transcribeAudio(blob);
        if (!transcript.trim()) {
          setHeard("Didn't catch that — try again?");
          setState("idle");
          return;
        }
        setState("processing");
        const result = await voiceRespond(targetWord, transcript);

        if (result.intent === "spelling_attempt") {
          const parsed = (result.parsedAttempt ?? "").trim();
          if (parsed) {
            onSpellingAttempt(parsed);
            setHeard(`Heard: ${parsed}`);
            markOnboarded();
          } else {
            setHeard("Didn't catch that — try again?");
          }
          setState("idle");
          return;
        }

        if (result.intent === "unknown") {
          setHeard("Didn't catch that — try again?");
          setState("idle");
          return;
        }

        // Support request
        setHeard(`Heard: ${transcript}`);
        onSupportResponse?.(result);
        markOnboarded();

        if (result.audioBase64) {
          const blobAudio = base64ToBlob(result.audioBase64, result.audioMimeType || "audio/mpeg");
          const url = URL.createObjectURL(blobAudio);
          audioUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          setState("playing");
          audio.onended = () => {
            stopPlayback();
            setState("idle");
          };
          audio.onerror = () => {
            stopPlayback();
            setState("idle");
          };
          await audio.play().catch(() => {
            stopPlayback();
            setState("idle");
          });
        } else {
          setState("idle");
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Voice failed. Try again.");
        setState("error");
        setTimeout(() => setState("idle"), 1500);
      }
    },
    [targetWord, onSpellingAttempt, onSupportResponse],
  );

  const startRecording = async () => {
    setErrorMsg(null);
    setHeard(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopVad();
        cleanupStream();
        handleResult(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("listening");

      // Voice Activity Detection: auto-stop after SILENCE_MS of silence
      // (only after the user has spoken at least once), with a MAX_RECORD_MS cap.
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyserRef.current = analyser;
        const buf = new Float32Array(analyser.fftSize);
        silenceStartRef.current = null;
        hasSpokenRef.current = false;

        const tick = () => {
          if (!analyserRef.current || !mediaRecorderRef.current) return;
          analyserRef.current.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const now = performance.now();
          if (rms > SILENCE_RMS) {
            hasSpokenRef.current = true;
            silenceStartRef.current = null;
          } else if (hasSpokenRef.current) {
            if (silenceStartRef.current == null) silenceStartRef.current = now;
            else if (now - silenceStartRef.current >= SILENCE_MS) {
              stopRecording();
              return;
            }
          }
          vadRafRef.current = requestAnimationFrame(tick);
        };
        vadRafRef.current = requestAnimationFrame(tick);

        maxStopTimerRef.current = window.setTimeout(() => {
          stopRecording();
        }, MAX_RECORD_MS);
      } catch (vadErr) {
        // VAD setup failed — fall back to manual stop only
        console.warn("VAD unavailable, falling back to manual stop", vadErr);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Microphone unavailable.");
      setState("error");
      setTimeout(() => setState("idle"), 1500);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  };

  const handleClick = () => {
    if (disabled) return;
    if (state === "listening") {
      stopRecording();
      return;
    }
    if (state === "idle" || state === "error") {
      startRecording();
    }
  };

  const isBusy = state === "transcribing" || state === "processing";
  const isDisabled = disabled || state === "playing" || isBusy;
  const isListening = state === "listening";

  return (
    <div className="flex flex-col items-center gap-1.5 mt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={isDisabled}
          aria-label={isListening ? "Stop recording" : "Start voice input"}
          className={cn(
            "relative inline-flex items-center justify-center h-11 w-11 rounded-full transition-all shadow-sm",
            isListening
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isListening ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          {isListening && (
            <span className="absolute inset-0 rounded-full animate-ping bg-destructive/40 -z-0" />
          )}
        </button>
        <div className="text-xs text-muted-foreground min-h-[1rem]">
          {errorMsg ?? stateLabel[state]}
        </div>
      </div>
      {heard && (
        <div className="text-xs font-medium text-foreground/80 italic">{heard}</div>
      )}
      {showOnboarding && !heard && state === "idle" && (
        <div className="text-xs text-muted-foreground">
          Ask for a hint or spell the word out loud.
        </div>
      )}
    </div>
  );
}
