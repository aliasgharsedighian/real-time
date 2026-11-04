import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { useChatList } from "@/features/chat/hooks/use-chat-list";
import { displayName } from "@/shared/lib/types";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Button } from "@/shared/ui/button";
import { useCalls } from "./context";
import type { CallRecord } from "./types";
export const statusText: Record<CallRecord["status"], string> = {
  RINGING: "Ringing",
  CONNECTING: "Connecting",
  ACTIVE: "In call",
  MISSED: "No answer",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  ENDED: "Call ended",
  FAILED: "Call failed",
};
function Stream({
  stream,
  muted = false,
  video = false,
  className = "",
}: {
  stream: MediaStream | null;
  muted?: boolean;
  video?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    void element.play().catch(() => {
      if (!muted) setBlocked(true);
    });
    return () => {
      element.srcObject = null;
    };
  }, [stream, muted]);
  return (
    <>
      {video ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={className}
        />
      ) : (
        <audio ref={ref} autoPlay muted={muted} />
      )}
      {blocked && (
        <Button
          className="absolute top-3 left-3 z-20"
          onClick={() => {
            void ref.current?.play().then(() => setBlocked(false));
          }}
        >
          <Volume2 />
          Play call audio
        </Button>
      )}
    </>
  );
}
export default function CallPage() {
  const { view, controller } = useCalls();
  const { user } = useSession();
  const chats = useChatList();
  const peer = chats.data
    ?.find((c) => c.id === view.chatId)
    ?.participants.find((p) => p.userId !== user?.id)?.user;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = view.call?.connectedAt
    ? Math.max(
        0,
        Math.floor(
          ((view.call.endedAt ? new Date(view.call.endedAt).getTime() : now) -
            new Date(view.call.connectedAt).getTime()) /
            1000,
        ),
      )
    : 0;
  const ringingSeconds = view.call
    ? Math.max(
        0,
        30 - Math.floor((now - new Date(view.call.createdAt).getTime()) / 1000),
      )
    : 30;
  const ended = view.phase === "ended" || view.phase === "idle";
  const showingVideo = view.mode === "video" && view.phase === "active";
  const label =
    view.error ||
    (view.phase === "idle"
      ? "No active call"
      : view.phase === "preparing"
        ? view.mode === "video"
          ? "Preparing microphone and camera…"
          : "Preparing microphone…"
        : view.phase === "active"
          ? `${Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
          : view.phase === "ringing"
            ? `Ringing… ${ringingSeconds}s`
            : view.phase === "connecting"
              ? "Connecting…"
              : view.call &&
                  !["RINGING", "CONNECTING", "ACTIVE"].includes(
                    view.call.status,
                  )
                ? statusText[view.call.status]
                : "Call ended");
  return (
    <section
      aria-label="Call screen"
      className="chat-scene relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-5"
    >
      {view.phase === "ringing" && (
        <audio autoPlay loop src="/sounds/outgoing-call.wav" />
      )}
      {view.remote && !ended && (
        <Stream
          stream={view.remote}
          video={view.mode === "video"}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      <div
        className={`z-10 flex flex-col items-center gap-4 rounded-3xl p-6 text-center ${showingVideo ? "absolute left-3 top-3 max-w-[55%] gap-1 bg-background/80 p-3" : ""}`}
      >
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand">
          {view.mode === "video" ? "Video call" : "Voice call"}
        </p>
        {!showingVideo && (
          <IdentityAvatar
            avatarId={peer?.profile?.avatarId}
            name={displayName(peer)}
            className="size-24 text-3xl ring-4 ring-brand/20 sm:size-32"
          />
        )}
        <h1
          className={`max-w-64 truncate font-semibold ${showingVideo ? "text-sm" : "text-2xl"}`}
        >
          {peer ? displayName(peer) : "BatGram"}
        </h1>
        <p
          role="status"
          className={`max-w-sm text-sm ${view.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {label}
        </p>
      </div>
      {view.mode === "video" && view.local && !view.cameraOff && (
        <Stream
          stream={view.local}
          muted
          video
          className="absolute right-3 top-3 z-10 h-28 w-24 rounded-xl border border-border bg-black object-cover [transform:scaleX(-1)] sm:h-40 sm:w-32"
        />
      )}
      {!ended ? (
        <div
          className={`z-10 flex items-center gap-4 rounded-full bg-background/90 p-3 shadow-lg ${showingVideo ? "absolute bottom-6" : ""}`}
        >
          <Button
            size="icon"
            variant={view.muted ? "secondary" : "outline"}
            className="size-13 rounded-full"
            aria-label={view.muted ? "Unmute microphone" : "Mute microphone"}
            aria-pressed={view.muted}
            disabled={!view.local}
            onClick={() => controller.toggleMute()}
          >
            {view.muted ? <MicOff /> : <Mic />}
          </Button>
          {view.mode === "video" && (
            <Button
              size="icon"
              variant={view.cameraOff ? "secondary" : "outline"}
              className="size-13 rounded-full"
              aria-label={view.cameraOff ? "Turn camera on" : "Turn camera off"}
              aria-pressed={view.cameraOff}
              disabled={!view.local}
              onClick={() => controller.toggleCamera()}
            >
              {view.cameraOff ? <VideoOff /> : <Video />}
            </Button>
          )}
          <Button
            size="icon"
            variant="destructive"
            className="size-14 rounded-full"
            aria-label="End call"
            onClick={() => controller.end()}
          >
            <PhoneOff />
          </Button>
        </div>
      ) : (
        <div className="z-10 flex gap-3">
          <Button asChild variant="outline">
            <Link to="/dashboard/calls">Call history</Link>
          </Button>
          {view.chatId && (
            <Button asChild>
              <Link to={`/dashboard/websocket/${view.chatId}`}>
                Back to chat
              </Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
