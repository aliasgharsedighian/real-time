import type { Socket } from "socket.io-client";
import type { CallMode, CallRecord, CallView } from "./types";
import { isLiveCall } from "./types";

type Signal =
  | RTCSessionDescriptionInit
  | { type: "ice"; candidate: RTCIceCandidateInit };
export async function callRequest<T>(
  socket: Socket,
  event: string,
  payload = {},
): Promise<T> {
  if (!socket.connected)
    throw new Error("Connection lost. Please reconnect and try again.");
  const result = await socket.timeout(8000).emitWithAck(event, payload);
  if (result?.message) throw new Error(result.message);
  return result as T;
}
const initial = (): CallView => ({
  call: null,
  incoming: null,
  phase: "idle",
  mode: "audio",
  chatId: null,
  local: null,
  remote: null,
  muted: false,
  cameraOff: false,
  error: null,
});
export class CallController {
  private view = initial();
  private listeners = new Set<() => void>();
  private peer: RTCPeerConnection | null = null;
  private candidates: RTCIceCandidateInit[] = [];
  private version = 0;
  private disposed = false;
  private disconnectTimer?: ReturnType<typeof setTimeout>;
  private incomingTimer?: ReturnType<typeof setTimeout>;
  private signalQueue: Promise<void> = Promise.resolve();
  constructor(
    private socket: Socket,
    readonly userId: number,
  ) {}
  snapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<CallView>) {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }
  attach() {
    this.disposed = false;
    this.socket.on("call:updated", this.onUpdated);
    this.socket.on("call:accepted", this.onAccepted);
    this.socket.on("call:signal", this.onSignal);
    this.socket.on("disconnect", this.onDisconnect);
    this.socket.on("connect", this.onConnect);
    if (this.socket.connected) this.onConnect();
  }
  dispose() {
    this.disposed = true;
    this.socket.off("call:updated", this.onUpdated);
    this.socket.off("call:accepted", this.onAccepted);
    this.socket.off("call:signal", this.onSignal);
    this.socket.off("disconnect", this.onDisconnect);
    this.socket.off("connect", this.onConnect);
    if (this.view.call && isLiveCall(this.view.call))
      this.socket.emit("call:end", { id: this.view.call.id });
    clearTimeout(this.incomingTimer);
    this.cleanup();
    this.view = initial();
  }
  private onConnect = () => {
    void callRequest<CallRecord | null>(this.socket, "call:pending")
      .then((call) => {
        if (
          call &&
          !this.disposed &&
          new Date(call.createdAt).getTime() + 30_000 > Date.now()
        )
          this.onUpdated(call);
      })
      .catch(() => {
        /* Socket recovery will retry on the next connection. */
      });
  };
  private cleanup() {
    this.version++;
    clearTimeout(this.disconnectTimer);
    this.peer?.close();
    this.peer = null;
    this.view.local?.getTracks().forEach((t) => t.stop());
    this.view.remote?.getTracks().forEach((t) => t.stop());
    this.candidates = [];
    this.update({ local: null, remote: null });
  }
  private onUpdated = (call: CallRecord) => {
    if (call.callerId !== this.userId && call.calleeId !== this.userId) return;
    if (
      this.view.call?.id === call.id ||
      (this.view.phase === "preparing" &&
        !this.view.call &&
        call.callerId === this.userId &&
        call.chatId === this.view.chatId)
    ) {
      this.update({
        call,
        phase:
          call.status === "ACTIVE"
            ? "active"
            : call.status === "CONNECTING"
              ? "connecting"
              : call.status === "RINGING"
                ? "ringing"
                : "ended",
      });
      if (!isLiveCall(call)) this.cleanup();
    }
    if (
      call.calleeId === this.userId &&
      call.status === "RINGING" &&
      !["preparing", "ringing", "connecting", "active"].includes(
        this.view.phase,
      )
    ) {
      this.update({ incoming: call });
      clearTimeout(this.incomingTimer);
      this.incomingTimer = setTimeout(
        () => {
          if (this.view.incoming?.id === call.id)
            this.update({ incoming: null });
        },
        Math.max(0, new Date(call.createdAt).getTime() + 30_000 - Date.now()),
      );
    } else if (
      this.view.incoming?.id === call.id &&
      call.status !== "RINGING"
    ) {
      clearTimeout(this.incomingTimer);
      this.update({ incoming: null });
    }
  };
  private onDisconnect = () => {
    if (
      ["preparing", "ringing", "connecting", "active"].includes(this.view.phase)
    ) {
      this.cleanup();
      this.update({
        phase: "ended",
        incoming: null,
        error: "Connection lost. The call has ended.",
      });
    } else this.update({ incoming: null });
  };
  private async prepare(mode: CallMode) {
    const version = this.version;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    )
      throw new Error(
        "Calling needs HTTPS or localhost and a browser with microphone/camera support.",
      );
    const config = await callRequest<RTCConfiguration>(
      this.socket,
      "call:config",
    );
    if (version !== this.version || this.disposed) return false;
    const local = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video",
    });
    if (version !== this.version || this.disposed) {
      local.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.update({ local });
    const peer = new RTCPeerConnection(config);
    this.peer = peer;
    this.update({ local, remote: new MediaStream() });
    local.getTracks().forEach((track) => peer.addTrack(track, local));
    peer.ontrack = ({ track }) => {
      if (
        this.peer === peer &&
        !this.view.remote?.getTracks().some((t) => t.id === track.id)
      ) {
        this.view.remote?.addTrack(track);
        this.update({ remote: this.view.remote });
      }
    };
    peer.onicecandidate = ({ candidate }) => {
      if (candidate && this.peer === peer && this.view.call)
        void this.sendSignal({
          type: "ice",
          candidate: candidate.toJSON(),
        }).catch((error: unknown) => {
          if (this.peer === peer) this.fail(error);
        });
    };
    peer.onconnectionstatechange = () => {
      if (this.peer !== peer) return;
      clearTimeout(this.disconnectTimer);
      if (peer.connectionState === "connected" && this.view.call)
        void callRequest(this.socket, "call:connected", {
          id: this.view.call.id,
        }).catch((error: unknown) => {
          if (this.peer === peer) this.fail(error);
        });
      if (peer.connectionState === "failed")
        this.fail(new Error("Could not connect the call. Please try again."));
      if (peer.connectionState === "disconnected")
        this.disconnectTimer = setTimeout(
          () => this.fail(new Error("The media connection was lost.")),
          10_000,
        );
    };
    return true;
  }
  async start(chatId: number, mode: CallMode) {
    if (
      ["preparing", "ringing", "connecting", "active"].includes(
        this.view.phase,
      ) ||
      this.view.incoming
    )
      throw new Error("Finish your current call first.");
    this.cleanup();
    this.update({ ...initial(), phase: "preparing", chatId, mode });
    const operation = this.version;
    try {
      if (!(await this.prepare(mode))) return;
      const version = this.version;
      const call = await callRequest<CallRecord>(this.socket, "call:start", {
        chatId,
        mode,
      });
      if (this.version !== version || this.disposed) {
        this.socket.emit("call:end", { id: call.id });
        return;
      }
      if (this.view.call?.id !== call.id)
        this.update({ call, phase: "ringing" });
    } catch (error) {
      if (operation === this.version) this.fail(error);
    }
  }
  async accept() {
    const call = this.view.incoming;
    if (!call) return;
    this.cleanup();
    this.update({
      ...initial(),
      call,
      chatId: call.chatId,
      mode: call.mode,
      phase: "preparing",
    });
    const operation = this.version;
    try {
      if (!(await this.prepare(call.mode))) return;
      await callRequest(this.socket, "call:accept", { id: call.id });
    } catch (error) {
      if (operation === this.version) this.fail(error);
    }
  }
  async reject() {
    const call = this.view.incoming;
    if (!call) return;
    await callRequest(this.socket, "call:end", { id: call.id });
    if (this.view.incoming?.id === call.id) this.update({ incoming: null });
  }
  end() {
    const call = this.view.call;
    if (call && isLiveCall(call)) this.socket.emit("call:end", { id: call.id });
    this.cleanup();
    this.update({ phase: "ended" });
  }
  private fail = (error: unknown) => {
    if (this.disposed) return;
    const call = this.view.call;
    if (call && isLiveCall(call))
      this.socket.emit("call:end", { id: call.id, failed: true });
    this.cleanup();
    const message =
      error instanceof Error ? error.message : "Could not start the call.";
    this.update({ phase: "ended", error: message });
  };
  private sendSignal(signal: Signal) {
    return callRequest(this.socket, "call:signal", {
      id: this.view.call!.id,
      signal,
    });
  }
  private onAccepted = (call: CallRecord) => {
    if (this.view.call?.id !== call.id || !this.peer) return;
    this.update({ call, phase: "connecting" });
    if (call.callerId === this.userId) {
      const peer = this.peer;
      void (async () => {
        await peer.setLocalDescription(await peer.createOffer());
        if (this.peer === peer)
          await this.sendSignal(peer.localDescription!.toJSON());
      })().catch((error: unknown) => {
        if (this.peer === peer) this.fail(error);
      });
    }
  };
  private onSignal = ({ id, signal }: { id: string; signal: Signal }) => {
    if (id !== this.view.call?.id || !this.peer) return;
    const peer = this.peer;
    // Serialize descriptions and trickled candidates; candidates may arrive before SDP.
    this.signalQueue = this.signalQueue
      .catch(() => {})
      .then(async () => {
        if (this.peer !== peer) return;
        if (signal.type === "ice") {
          if (peer.remoteDescription)
            await peer.addIceCandidate(signal.candidate);
          else this.candidates.push(signal.candidate);
        } else {
          await peer.setRemoteDescription(signal);
          for (const candidate of this.candidates)
            await peer.addIceCandidate(candidate);
          this.candidates = [];
          if (signal.type === "offer") {
            await peer.setLocalDescription(await peer.createAnswer());
            if (this.peer === peer)
              await this.sendSignal(peer.localDescription!.toJSON());
          }
        }
      })
      .catch((error: unknown) => {
        if (this.peer === peer) this.fail(error);
      });
  };
  toggleMute() {
    const muted = !this.view.muted;
    this.view.local?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.update({ muted });
  }
  toggleCamera() {
    const cameraOff = !this.view.cameraOff;
    this.view.local?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
    this.update({ cameraOff });
  }
}
