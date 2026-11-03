import { useEffect } from "react";
import type { CSSProperties } from "react";
import { Outlet, useMatch } from "react-router-dom";
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
      : "Messages";
  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "19rem" } as CSSProperties}
      className="h-dvh min-h-0 overflow-hidden"
    >
      <ChatSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="truncate font-medium">{title}</h1>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
