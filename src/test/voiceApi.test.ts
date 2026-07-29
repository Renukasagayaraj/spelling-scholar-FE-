import { afterEach, describe, expect, it, vi } from "vitest";
import { base64ToBlob, transcribeAudio, voiceRespond } from "@/lib/voiceApi";

describe("voice API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads audio with its MIME type and filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "necessary" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob(["audio"], { type: "audio/ogg" });

    await expect(transcribeAudio(blob, "answer.ogg")).resolves.toBe("necessary");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/audio\/transcribe$/), {
      method: "POST",
      headers: { "Content-Type": "audio/ogg", "x-audio-filename": "answer.ogg" },
      body: blob,
    });
  });

  it("uses defaults and handles a response without text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcribeAudio(new Blob([]))).resolves.toBe("");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "Content-Type": "audio/webm",
      "x-audio-filename": "recording.webm",
    });
  });

  it("rejects failed transcription requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(transcribeAudio(new Blob([]))).rejects.toThrow("Transcription failed");
  });

  it("posts voice response requests and returns the payload", async () => {
    const payload = { intent: "spelling_attempt", parsedAttempt: "rhythm", shouldAutoSubmit: true };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    await expect(voiceRespond("rhythm", "r h y t h m")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/voice\/respond$/), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetWord: "rhythm", utterance: "r h y t h m", includeAudio: true }),
    });
  });

  it("rejects failed voice response requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(voiceRespond("word", "utterance")).rejects.toThrow("Voice respond failed");
  });

  it("decodes base64 with default and custom MIME types", async () => {
    const defaultBlob = base64ToBlob("SGk=");
    const customBlob = base64ToBlob("AAE=", "audio/wav");
    expect(defaultBlob).toMatchObject({ type: "audio/mpeg", size: 2 });
    expect(customBlob).toMatchObject({ type: "audio/wav", size: 2 });
  });
});
