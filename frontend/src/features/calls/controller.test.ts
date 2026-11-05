import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";
import { CallController } from "./controller";
import type { CallRecord } from "./types";
const record = (patch: Partial<CallRecord> = {}): CallRecord => ({
  id: "call-1",
  chatId: 1,
  callerId: 10,
  calleeId: 20,
  mode: "audio",
  status: "RINGING",
  createdAt: new Date().toISOString(),
  answeredAt: null,
  connectedAt: null,
  endedAt: null,
  ...patch,
});
describe("call media lifecycle", () => {
  let controller: CallController;
  let handlers: Record<string, (payload?: unknown) => void>;
  let socket: Socket;
  let audio: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
  let camera: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
  let media: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    handlers = {};
    audio = { stop: vi.fn(), enabled: true };
    camera = { stop: vi.fn(), enabled: true };
    media = vi.fn().mockResolvedValue({
      getTracks: () => [audio, camera],
      getAudioTracks: () => [audio],
      getVideoTracks: () => [camera],
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: media } });
    vi.stubGlobal(
      "MediaStream",
      class {
        getTracks() {
          return [];
        }
      },
    );
    vi.stubGlobal(
      "RTCPeerConnection",
      class {
        close = vi.fn();
        addTrack = vi.fn();
      },
    );
    request = vi.fn(async (event: string) =>
      event === "call:config" ? { iceServers: [] } : record(),
    );
    socket = {
      connected: true,
      on: vi.fn((event, cb) => {
        handlers[event] = cb;
      }),
      off: vi.fn(),
      timeout: () => socket,
      emitWithAck: request,
      emit: vi.fn(),
    } as unknown as Socket;
    controller = new CallController(socket, 10);
    controller.attach();
  });
  afterEach(() => {
    controller.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("uses only microphone in voice mode and releases media on hangup", async () => {
    await controller.start(1, "audio");
    expect(media).toHaveBeenCalledWith({ audio: true, video: false });
    controller.toggleMute();
    expect(audio.enabled).toBe(false);
    controller.end();
    expect(audio.stop).toHaveBeenCalled();
    expect(camera.stop).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith("call:end", { id: "call-1" });
    expect(controller.snapshot().local).toBeNull();
  });
  it("requests both tracks for video and can disable the camera", async () => {
    await controller.start(1, "video");
    expect(media).toHaveBeenCalledWith({ audio: true, video: true });
    controller.toggleCamera();
    expect(camera.enabled).toBe(false);
  });
  it("does not ring if permission is denied", async () => {
    media.mockRejectedValue(new Error("Permission denied"));
    await controller.start(1, "audio");
    expect(request).not.toHaveBeenCalledWith("call:start", expect.anything());
    expect(controller.snapshot()).toMatchObject({
      phase: "ended",
      error: "Permission denied",
    });
  });
  it("stops streams delivered after cancellation without starting a call", async () => {
    let resolve!: (stream: unknown) => void;
    media.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const start = controller.start(1, "audio");
    await vi.waitFor(() => expect(media).toHaveBeenCalled());
    controller.end();
    resolve({ getTracks: () => [audio] });
    await start;
    expect(audio.stop).toHaveBeenCalled();
    expect(request).not.toHaveBeenCalledWith("call:start", expect.anything());
  });
  it("cleans up an unanswered call and handles disconnects", async () => {
    await controller.start(1, "audio");
    handlers["call:updated"](
      record({ status: "MISSED", endedAt: new Date().toISOString() }),
    );
    expect(controller.snapshot().phase).toBe("ended");
    expect(audio.stop).toHaveBeenCalled();
    await controller.start(1, "audio");
    handlers.disconnect();
    expect(controller.snapshot()).toMatchObject({
      phase: "ended",
      local: null,
      error: expect.stringContaining("Connection lost"),
    });
  });
  it("receives calls globally without opening devices before acceptance", () => {
    handlers["call:updated"](record({ callerId: 20, calleeId: 10 }));
    expect(controller.snapshot().incoming?.id).toBe("call-1");
    expect(media).not.toHaveBeenCalled();
    handlers["call:updated"](
      record({ callerId: 20, calleeId: 10, status: "CANCELLED" }),
    );
    expect(controller.snapshot().incoming).toBeNull();
  });
  it("stops media and clears the current call when the conversation is deleted", async () => {
    await controller.start(1, "audio");
    handlers["chat:removed"]({ chatId: 1 });
    expect(audio.stop).toHaveBeenCalled();
    expect(controller.snapshot().phase).toBe("idle");
    expect(controller.snapshot().call).toBeNull();
  });
});
