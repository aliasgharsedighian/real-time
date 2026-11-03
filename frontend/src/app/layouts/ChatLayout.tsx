import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Link, Outlet, useMatch } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { skipToken, useQuery } from "@tanstack/react-query";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { Separator } from "@/shared/ui/separator";
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

export default function ChatLayout() {
  const match = useMatch("/dashboard/websocket/:chatId");
  const profile = useMatch("/dashboard/profile");
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const history = useQuery<History>({
    queryKey: chatKeys.history(identity, Number(match?.params.chatId)),
    queryFn: skipToken,
    enabled: false,
  });
  const participants = history.data?.users ?? [];
  const title = profile
    ? "Profile"
    : match
      ? participants.length > 1
        ? "Group Chat"
        : displayName(participants[0]?.user)
      : "BatGram";
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
      <SidebarInset className="min-w-0">
        <header className="flex min-h-18 shrink-0 items-center gap-3 border-b border-border bg-card/50 px-3 pt-[env(safe-area-inset-top)] sm:px-5">
          {(match || profile) && (
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
            className={`size-11 shrink-0 ${match || profile ? "hidden md:inline-flex" : ""}`}
          />
          <Separator orientation="vertical" className="hidden h-6 md:block" />
          {match ? (
            <>
              <IdentityAvatar name={title} className="size-10" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">{title}</h1>
                <p className="mt-0.5 text-xs text-brand">Conversation</p>
              </div>
            </>
          ) : profile ? (
            <h1 className="font-semibold">My profile</h1>
          ) : (
            <Brand className="w-36" />
          )}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
