import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  voiceRespond: vi.fn(),
  base64ToBlob: vi.fn(),
}));

vi.mock("@/lib/voiceApi", () => api);

import { VoiceMic } from "@/components/VoiceMic";

type DataHandler = ((event: { data: Blob }) => void) | null;

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static latest: FakeMediaRecorder | null = null;
  state = "inactive";
  mimeType: string;
  ondataavailable: DataHandler = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? "";
    FakeMediaRecorder.latest = this;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const trackStop = vi.fn();
const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
const getUserMedia = vi.fn();
const createObjectURL = vi.fn(() => "blob:voice");
const revokeObjectURL = vi.fn();
let latestAudio: {
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  onended: null | (() => void);
  onerror: null | (() => void);
} | null = null;

function installAudio(play: () => Promise<void> = () => Promise.resolve()) {
  vi.stubGlobal("Audio", vi.fn(() => {
    latestAudio = { pause: vi.fn(), play: vi.fn(play), onended: null, onerror: null };
    return latestAudio;
  }));
}

async function recordOnce() {
  const start = screen.getByRole("button", { name: "Start voice input" });
  await waitFor(() => expect(start).not.toBeDisabled());
  fireEvent.click(start);
  await screen.findByRole("button", { name: "Stop recording" });
  fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
}

describe("VoiceMic", () => {
  beforeEach(() => {
    localStorage.clear();
    FakeMediaRecorder.latest = null;
    latestAudio = null;
    vi.clearAllMocks();
    getUserMedia.mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: class { constructor() { throw new Error("no web audio"); } },
    });
    installAudio();
    api.transcribeAudio.mockResolvedValue("spell friend");
    api.voiceRespond.mockResolvedValue({ intent: "spelling_attempt", parsedAttempt: "friend" });
    api.base64ToBlob.mockReturnValue(new Blob(["audio"], { type: "audio/mpeg" }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("honors disabled state and starts/stops a supported recording", async () => {
    const attempt = vi.fn();
    const view = render(<VoiceMic targetWord="friend" disabled onSpellingAttempt={attempt} />);
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(getUserMedia).not.toHaveBeenCalled();
    view.rerender(<VoiceMic targetWord="friend" onSpellingAttempt={attempt} />);

    await recordOnce();
    await waitFor(() => expect(attempt).toHaveBeenCalledWith("friend"));
    expect(api.transcribeAudio).toHaveBeenCalledWith(expect.objectContaining({ type: "audio/webm" }));
    expect(trackStop).toHaveBeenCalled();
    expect(screen.getByText("Heard: friend")).toBeInTheDocument();
    expect(localStorage.getItem("voice-mic-onboarded")).toBe("1");
  });

  it("uses the recorder default MIME type when webm is unsupported", async () => {
    FakeMediaRecorder.isTypeSupported.mockReturnValueOnce(false);
    render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    await recordOnce();
    await waitFor(() => expect(api.transcribeAudio).toHaveBeenCalled());
    expect(FakeMediaRecorder.latest?.mimeType).toBe("");
  });

  it("handles empty transcripts, empty parsed attempts, and unknown intent", async () => {
    const attempt = vi.fn();
    api.transcribeAudio.mockResolvedValueOnce("   ");
    const view = render(<VoiceMic targetWord="friend" onSpellingAttempt={attempt} />);
    await recordOnce();
    expect(await screen.findByText("Didn't catch that — try again?")).toBeInTheDocument();

    api.transcribeAudio.mockResolvedValueOnce("letters");
    api.voiceRespond.mockResolvedValueOnce({ intent: "spelling_attempt", parsedAttempt: "   " });
    await recordOnce();
    expect(attempt).not.toHaveBeenCalled();

    api.transcribeAudio.mockResolvedValueOnce("something");
    api.voiceRespond.mockResolvedValueOnce({ intent: "unknown" });
    await recordOnce();
    expect(await screen.findByText("Didn't catch that — try again?")).toBeInTheDocument();
    view.unmount();
  });

  it("publishes support responses without audio", async () => {
    const support = vi.fn();
    api.transcribeAudio.mockResolvedValueOnce("definition please");
    api.voiceRespond.mockResolvedValueOnce({ intent: "definition", displayText: "A trusted person" });
    render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} onSupportResponse={support} />);
    await recordOnce();
    await waitFor(() => expect(support).toHaveBeenCalledWith(expect.objectContaining({ intent: "definition" })));
    expect(screen.getByText("Heard: definition please")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start voice input" })).not.toBeDisabled();
  });

  it("plays support audio and cleans it up when playback ends", async () => {
    api.transcribeAudio.mockResolvedValueOnce("origin please");
    api.voiceRespond.mockResolvedValueOnce({ intent: "origin", audioBase64: "AA==", audioMimeType: "audio/wav" });
    const view = render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    await recordOnce();
    await waitFor(() => expect(api.base64ToBlob).toHaveBeenCalledWith("AA==", "audio/wav"));
    expect(createObjectURL).toHaveBeenCalled();
    expect(latestAudio?.play).toHaveBeenCalled();
    act(() => latestAudio?.onended?.());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice");
    expect(latestAudio?.pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start voice input" })).not.toBeDisabled();
    view.unmount();
  });

  it("uses the default audio MIME and recovers from playback rejection or error", async () => {
    installAudio(() => Promise.reject(new Error("autoplay")));
    api.voiceRespond.mockResolvedValueOnce({ intent: "definition", audioBase64: "AA==" });
    render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    await recordOnce();
    await waitFor(() => expect(api.base64ToBlob).toHaveBeenCalledWith("AA==", "audio/mpeg"));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalled());

    installAudio();
    api.voiceRespond.mockResolvedValueOnce({ intent: "origin", audioBase64: "AA==" });
    await recordOnce();
    await waitFor(() => expect(latestAudio?.onerror).toBeTypeOf("function"));
    act(() => latestAudio?.onerror?.());
    expect(screen.getByRole("button", { name: "Start voice input" })).not.toBeDisabled();
  });

  it("reports microphone and processing failures and returns to idle", async () => {
    vi.useFakeTimers();
    getUserMedia.mockRejectedValueOnce(new Error("denied"));
    render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    await act(async () => Promise.resolve());
    expect(screen.getByText("Microphone unavailable.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));

    api.transcribeAudio.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    await act(async () => Promise.resolve());
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await act(async () => Promise.resolve());
    expect(screen.getByText("Voice failed. Try again.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeInTheDocument();
  });

  it("stops tracks and active playback on unmount", async () => {
    api.voiceRespond.mockResolvedValueOnce({ intent: "definition", audioBase64: "AA==" });
    const view = render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    await recordOnce();
    await waitFor(() => expect(latestAudio?.play).toHaveBeenCalled());
    view.unmount();
    expect(latestAudio?.pause).toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:voice");
  });

  it("continues when onboarding storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    await recordOnce();
    expect(await screen.findByText("Heard: friend")).toBeInTheDocument();
  });

  it("falls back to showing onboarding when storage reads are blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<VoiceMic targetWord="friend" onSpellingAttempt={vi.fn()} />);
    expect(screen.getByText("Ask for a hint or spell the word out loud.")).toBeInTheDocument();
  });

  it("uses Web Audio activity detection to stop after spoken audio becomes silent", async () => {
    const frames: FrameRequestCallback[] = [];
    let sample = 0;
    const analyser = {
      fftSize: 0,
      getFloatTimeDomainData: vi.fn((buffer: Float32Array) => {
        buffer.fill(sample === 0 ? 0.2 : 0);
        sample += 1;
      }),
    };
    const closeAudioContext = vi.fn(() => Promise.resolve());
    const connect = vi.fn();
    class FakeAudioContext {
      createMediaStreamSource = vi.fn(() => ({ connect }));
      createAnalyser = vi.fn(() => analyser);
      close() {
        return closeAudioContext();
      }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const attempt = vi.fn();
    render(<VoiceMic targetWord="friend" onSpellingAttempt={attempt} />);
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    await screen.findByRole("button", { name: "Stop recording" });

    act(() => frames.shift()?.(0));
    now = 100;
    act(() => frames.shift()?.(16));
    now = 1700;
    await act(async () => frames.shift()?.(32));

    await waitFor(() => expect(attempt).toHaveBeenCalledWith("friend"));
    expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(3);
    expect(connect).toHaveBeenCalledWith(analyser);
    expect(closeAudioContext).toHaveBeenCalled();
  });

  it("stops recording at the maximum duration when no silence is detected", async () => {
    vi.useFakeTimers();
    const analyser = { fftSize: 0, getFloatTimeDomainData: vi.fn() };
    class FakeAudioContext {
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      createAnalyser = vi.fn(() => analyser);
      close = vi.fn(() => Promise.resolve());
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const attempt = vi.fn();
    render(<VoiceMic targetWord="friend" onSpellingAttempt={attempt} />);
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    await act(async () => Promise.resolve());
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    vi.useRealTimers();
    await waitFor(() => expect(attempt).toHaveBeenCalledWith("friend"));
  });
});
