import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Phone, Video, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { useChatList } from "@/features/chat/hooks/use-chat-list";
import { useSessionStore } from "@/features/auth/session-store";
import { getSocket } from "@/features/chat/socket";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName } from "@/shared/lib/types";
import { Button } from "@/shared/ui/button";
import { callRequest } from "./controller";
import { CallButton } from "./CallButton";
import { statusText } from "./CallPage";
import type { CallRecord } from "./types";
export default function CallsPage() {
  const { user } = useSession();
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const chats = useChatList();
  const calls = useQuery({
    queryKey: ["calls", identity],
    queryFn: () => callRequest<CallRecord[]>(getSocket(), "call:list"),
    refetchInterval: 10_000,
    retry: 1,
  });
  return (
    <section className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Phone className="text-brand" />
        <h1 className="text-2xl font-semibold">Calls</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Voice and video calls with your contacts. Start a call from a one-to-one
        chat.
      </p>
      {calls.isPending && <p role="status">Loading calls…</p>}
      {calls.isError && (
        <div role="alert">
          <p>Could not load call history.</p>
          <Button
            variant="outline"
            onClick={() => {
              void calls.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {calls.data?.length === 0 && (
        <div className="brand-panel rounded-2xl p-10 text-center">
          <Phone className="mx-auto mb-4 size-10 text-brand" />
          <p>No calls yet</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Open chats</Link>
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {calls.data?.map((call) => {
          const peer = chats.data
            ?.find((c) => c.id === call.chatId)
            ?.participants.find((p) => p.userId !== user?.id)?.user;
          const outgoing = call.callerId === user?.id;
          const missed = ["MISSED", "FAILED", "REJECTED"].includes(call.status);
          const duration =
            call.connectedAt && call.endedAt
              ? Math.max(
                  0,
                  Math.floor(
                    (new Date(call.endedAt).getTime() -
                      new Date(call.connectedAt).getTime()) /
                      1000,
                  ),
                )
              : null;
          return (
            <li
              key={call.id}
              className="brand-panel flex items-center gap-3 rounded-2xl p-3"
            >
              <Link
                className="flex min-w-0 flex-1 items-center gap-3"
                to={`/dashboard/websocket/${call.chatId}`}
              >
                <IdentityAvatar
                  avatarId={peer?.profile?.avatarId}
                  name={displayName(peer)}
                  className="size-12"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {peer ? displayName(peer) : "Conversation"}
                  </p>
                  <p
                    className={`flex items-center gap-1 text-xs ${missed ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {outgoing ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownLeft className="size-3" />
                    )}
                    {outgoing ? "Outgoing" : "Incoming"} ·{" "}
                    {statusText[call.status]}
                    {duration !== null
                      ? ` · ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`
                      : ""}
                  </p>
                  <time
                    className="text-[11px] text-muted-foreground"
                    dateTime={call.createdAt}
                  >
                    {new Date(call.createdAt).toLocaleString()}
                  </time>
                </div>
              </Link>
              {call.mode === "video" ? (
                <Video className="hidden size-4 text-muted-foreground sm:block" />
              ) : (
                <Phone className="hidden size-4 text-muted-foreground sm:block" />
              )}
              <CallButton chatId={call.chatId} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
