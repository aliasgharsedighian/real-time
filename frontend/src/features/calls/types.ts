export type CallMode = "audio" | "video";
export interface CallRecord {
  id: string;
  chatId: number;
  callerId: number;
  calleeId: number;
  mode: CallMode;
  status:
    | "RINGING"
    | "CONNECTING"
    | "ACTIVE"
    | "MISSED"
    | "REJECTED"
    | "CANCELLED"
    | "ENDED"
    | "FAILED";
  createdAt: string;
  answeredAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
}
export const isLiveCall = (call: CallRecord) =>
  ["RINGING", "CONNECTING", "ACTIVE"].includes(call.status);
export interface CallView {
  call: CallRecord | null;
  incoming: CallRecord | null;
  phase: "idle" | "preparing" | "ringing" | "connecting" | "active" | "ended";
  mode: CallMode;
  chatId: number | null;
  local: MediaStream | null;
  remote: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  error: string | null;
}
