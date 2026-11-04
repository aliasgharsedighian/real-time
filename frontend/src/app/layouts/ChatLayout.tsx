import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Link, Outlet, useMatch, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { Separator } from "@/shared/ui/separator";
import { GroupInfoDialog } from "@/features/chat/components/GroupInfoDialog";
import { ChatSidebar } from "@/features/chat/components/ChatSidebar";
import { getSocket } from "@/features/chat/socket";
import { chatKeys } from "@/features/chat/api";
import type { History } from "@/features/chat/types";
import { useSessionStore } from "@/features/auth/session-store";
import { displayName } from "@/shared/lib/types";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { Brand } from "@/shared/components/Brand";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Button } from "@/shared/ui/button";
import CallProvider from "@/features/calls/CallProvider";
import { CallButton } from "@/features/calls/CallButton";

export default function ChatLayout() {
  return (
    <CallProvider>
      <ChatLayoutContent />
    </CallProvider>
  );
}

function ChatLayoutContent() {
  const match = useMatch("/dashboard/websocket/:chatId");
  const profile = useMatch("/dashboard/profile");
  const calls = useMatch("/dashboard/calls/*");
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const history = useQuery<History>({
    queryKey: chatKeys.history(identity, Number(match?.params.chatId)),
    queryFn: skipToken,
    enabled: false,
  });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const group = history.data?.chat?.isGroup ? history.data.chat : undefined;
  const participants = history.data?.users ?? [];
  const title = profile
    ? "Profile"
    : match
      ? group
        ? group.name || "Group"
        : displayName(participants[0]?.user)
      : "BatGram";
  useEffect(() => {
    const socket = getSocket();
    const updated = ({ chatId }: { chatId: number }) => {
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
      void cache.invalidateQueries({
        queryKey: chatKeys.history(identity, chatId),
      });
    };
    const removed = ({ chatId }: { chatId: number }) => {
      cache.removeQueries({ queryKey: chatKeys.history(identity, chatId) });
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
      if (Number(match?.params.chatId) === chatId)
        navigate("/dashboard", { replace: true });
    };
    socket.on("chat:updated", updated);
    socket.on("chat:removed", removed);
    return () => {
      socket.off("chat:updated", updated);
      socket.off("chat:removed", removed);
    };
  }, [cache, identity, match?.params.chatId, navigate]);
  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "21rem",
          "--sidebar-width-icon": "4.25rem",
        } as CSSProperties
      }
      className="h-dvh min-h-0 overflow-hidden"
    >
      <ChatSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <header className="flex min-h-18 shrink-0 items-center gap-3 border-b border-border bg-card/50 px-3 pt-[env(safe-area-inset-top)] sm:px-5">
          {(match || profile || calls) && (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:hidden"
            >
              <Link to="/dashboard" aria-label="Back to chats">
                <ArrowLeft />
              </Link>
            </Button>
          )}
          <SidebarTrigger
            className={`size-11 shrink-0 ${match || profile || calls ? "hidden md:inline-flex" : ""}`}
          />
          <Separator orientation="vertical" className="hidden h-6 md:block" />
          {match ? (
            group ? (
              <GroupInfoDialog
                chat={group}
                trigger={
                  <>
                    <IdentityAvatar
                      avatarId={group.avatarId}
                      name={title}
                      className="size-10"
                    />
                    <div className="min-w-0">
                      <h1 className="truncate text-sm font-semibold">
                        {title}
                      </h1>
                      <p className="mt-0.5 truncate text-xs text-brand">
                        {group.participants.length} members · Group info
                      </p>
                    </div>
                  </>
                }
              />
            ) : (
              <>
                <IdentityAvatar
                  avatarId={participants[0]?.user.profile?.avatarId}
                  name={title}
                  className="size-10"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold">{title}</h1>
                  <p className="mt-0.5 text-xs text-brand">Conversation</p>
                </div>
              </>
            )
          ) : profile ? (
            <h1 className="font-semibold">My profile</h1>
          ) : (
            <Brand className="w-36" />
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {match && history.data?.chat && !group && (
              <CallButton chatId={Number(match.params.chatId)} />
            )}
            <ThemeToggle />
          </div>
        </header>
        <div
          className={`flex min-h-0 flex-1 flex-col ${match ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
