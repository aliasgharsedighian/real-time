import { useState } from "react";
import { NavLink } from "react-router-dom";
import { MessageCircle, RefreshCw } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  useSidebar,
} from "@/shared/ui/sidebar";
import { Button } from "@/shared/ui/button";
import { displayName } from "@/shared/lib/types";
import { formatDateBasedOnToday } from "@/shared/lib/date";
import { errorMessage } from "@/shared/lib/api";
import { useSession } from "@/features/auth/session-context";
import UserButton from "@/features/auth/components/UserButton";
import { useChatList } from "../hooks/use-chat-list";
import { NewChatDialog } from "./NewChatDialog";

export function ChatSidebar() {
  const { user } = useSession();
  const { setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const chats = useChatList();
  return (
    <Sidebar variant="floating">
      <NewChatDialog open={open} onOpenChange={setOpen} />
      <SidebarHeader>
        <div className="flex items-center justify-between p-2">
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground">Welcome back</span>
            <p className="truncate text-sm font-semibold">
              {displayName(user)}
            </p>
          </div>
          <UserButton />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Button
            variant="outline"
            className="mb-3 w-full"
            onClick={() => setOpen(true)}
          >
            Start New Chat
          </Button>
          {chats.isPending && (
            <p role="status" className="py-8 text-center text-sm">
              Loading chats…
            </p>
          )}
          {chats.isError && (
            <div className="space-y-3 p-3 text-sm">
              <p role="alert">{errorMessage(chats.error)}</p>
              <Button variant="outline" onClick={() => void chats.refetch()}>
                <RefreshCw />
                Try again
              </Button>
            </div>
          )}
          {chats.data?.length === 0 && (
            <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
              <MessageCircle className="size-16 opacity-20" />
              <h2 className="text-xl font-medium">Ready to chat?</h2>
              <p className="text-sm text-muted-foreground">
                Your conversations will appear here once you start chatting with
                others.
              </p>
            </div>
          )}
          <nav aria-label="Conversations" className="flex flex-col gap-2">
            {chats.data?.map((chat) => (
              <NavLink
                key={chat.id}
                to={`/dashboard/websocket/${chat.id}`}
                onClick={() => setOpenMobile(false)}
                className={({ isActive }) =>
                  `rounded-md border-b px-2 py-3 ${isActive ? "bg-muted" : "hover:bg-muted/50"}`
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold">
                    {chat.isGroup || chat.participants.length > 1
                      ? "Group"
                      : displayName(chat.participants[0]?.user)}
                  </span>
                  {!!chat._count?.messages && (
                    <span className="flex min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-sm text-white">
                      {chat._count.messages}
                    </span>
                  )}
                </div>
                {chat.messages?.slice(0, 1).map((message) => (
                  <div
                    key={message.id}
                    className="mt-1 flex justify-between gap-2"
                  >
                    <p className="truncate text-sm">{message.content}</p>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateBasedOnToday(message.createdAt)}
                    </span>
                  </div>
                ))}
              </NavLink>
            ))}
          </nav>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
