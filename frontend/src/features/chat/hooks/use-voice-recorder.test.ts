import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceRecorder } from "./use-voice-recorder";

class Recorder {
  static isTypeSupported = () => true;
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["voice"], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}
const stop = vi.fn();
const stream = { getTracks: () => [{ stop }] };
const getUserMedia = vi.fn();
function setup() {
  const onReady = vi.fn();
  const onError = vi.fn();
  return {
    ...renderHook(() =>
      useVoiceRecorder({ maxSeconds: 300, maxBytes: 20e6, onReady, onError }),
    ),
    onReady,
    onError,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("MediaRecorder", Recorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  getUserMedia.mockResolvedValue(stream);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("voice recorder lifecycle", () => {
  it("records while held and prepares a local file on release", async () => {
    const { result, onReady } = setup();
    await act(() => result.current.start());
    expect(result.current.status).toBe("recording");
    expect(onReady).not.toHaveBeenCalled();
    act(() => result.current.stop());
    expect(onReady.mock.calls[0][0]).toBeInstanceOf(File);
    expect(onReady.mock.calls[0][0].type).toBe("audio/webm");
    expect(result.current.status).toBe("idle");
    expect(stop).toHaveBeenCalled();
  });
  it("does not begin recording when permission arrives after release", async () => {
    let resolve!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, onReady } = setup();
    let started!: Promise<void>;
    act(() => {
      started = result.current.start();
    });
    act(() => result.current.stop());
    await act(async () => {
      resolve(stream);
      await started;
    });
    expect(result.current.status).toBe("idle");
    expect(onReady).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
  it("discards cancelled recordings", async () => {
    const { result, onReady } = setup();
    await act(() => result.current.start());
    act(() => result.current.cancel());
    expect(onReady).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
  it("stops microphone tracks on unmount and ignores late callbacks", async () => {
    const { result, onReady, unmount } = setup();
    await act(() => result.current.start());
    unmount();
    expect(stop).toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });
  it("reports denied microphone permission", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    const { result, onError } = setup();
    await act(() => result.current.start());
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("denied"));
    expect(result.current.status).toBe("idle");
  });
});
