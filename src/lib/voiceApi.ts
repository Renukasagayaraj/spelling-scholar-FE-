const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export type VoiceIntent =
  | "repeat_word"
  | "example_sentence"
  | "definition"
  | "origin"
  | "part_of_speech"
  | "spelling_attempt"
  | "unknown";

export interface VoiceRespondResult {
  intent: VoiceIntent;
  displayText?: string;
  spokenText?: string;
  audioBase64?: string;
  audioMimeType?: string;
  parsedAttempt?: string;
  shouldAutoSubmit?: boolean;
}

export async function transcribeAudio(blob: Blob, filename = "recording.webm"): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/audio/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
      "x-audio-filename": filename,
    },
    body: blob,
  });
  if (!res.ok) throw new Error("Transcription failed");
  const data = await res.json();
  return data.text ?? "";
}

export async function voiceRespond(
  challenge: { challengeId: string; sessionId: string },
  utterance: string,
): Promise<VoiceRespondResult> {
  const { authHeaders } = await import("./api.js");
  const res = await fetch(`${BASE_URL}/api/voice/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ challengeId: challenge.challengeId, sessionId: challenge.sessionId, utterance, includeAudio: true }),
  });
  if (!res.ok) throw new Error("Voice respond failed");
  return res.json();
}

export function base64ToBlob(base64: string, mime = "audio/mpeg"): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
