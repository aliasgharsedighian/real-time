import { useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Users, MessageCircle, Plus, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName } from "@/shared/lib/types";
import { formatDateBasedOnToday } from "@/shared/lib/date";
import { errorMessage } from "@/shared/lib/api";
import { useChatList } from "../hooks/use-chat-list";
import { NewChatDialog } from "./NewChatDialog";
import { useInboxTyping } from "../hooks/use-inbox-typing";

export function ChatList({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const chats = useChatList();
  const typing = useInboxTyping();
  const visible = useMemo(
    () =>
      chats.data?.filter((chat) => {
        const title = chat.isGroup
          ? chat.name || "Group"
          : displayName(chat.participants[0]?.user);
        return (
          title
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()) &&
          (filter === "all" || !!chat._count?.messages)
        );
      }) ?? [],
    [chats.data, search, filter],
  );
  const unread =
    chats.data?.filter((chat) => !!chat._count?.messages).length ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NewChatDialog open={open} onOpenChange={setOpen} />
      <div className="shrink-0 space-y-2 px-4 pt-2 pb-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Chats</h2>
          <div className="flex items-center gap-1">
            <Button
              ref={searchButton}
              variant="ghost"
              size="icon"
              className="size-11 text-brand"
              aria-label="Search conversations"
              aria-expanded={searchOpen}
              aria-controls="conversation-search"
              onClick={() => {
                setSearchOpen((previous) => !previous);
                setSearch("");
              }}
            >
              <Search />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-brand"
              aria-label="Start new chat"
              onClick={() => setOpen(true)}
            >
              <Plus />
            </Button>
          </div>
        </div>
        {searchOpen && (
          <div className="relative" id="conversation-search">
            <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" />
            <Input
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  setSearch("");
                  searchButton.current?.focus();
                }
              }}
              className="h-11 rounded-xl border-border bg-background/60 pr-10 pl-9"
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                className="absolute top-0 right-0 grid size-11 place-items-center text-muted-foreground"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
        <div
          className="flex gap-2 border-b border-border pb-3"
          aria-label="Conversation filters"
        >
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-10 rounded-full px-4 text-xs font-medium transition-colors ${filter === value ? "border border-primary/30 bg-primary/10 text-brand" : "border border-transparent text-muted-foreground hover:bg-muted"}`}
            >
              {value === "all" ? "All chats" : "Unread"}
              {value === "unread" && unread > 0 && (
                <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-brand">
                  {unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {chats.isPending && (
          <div role="status" className="space-y-4 p-3">
            <span className="sr-only">Loading chats…</span>
            {[1, 2, 3, 4].map((id) => (
              <div key={id} className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <Skeleton className="h-12 flex-1" />
              </div>
            ))}
          </div>
        )}
        {chats.isError && (
          <div className="space-y-3 p-4 text-center text-sm">
            <p role="alert">{errorMessage(chats.error)}</p>
            <Button variant="outline" onClick={() => void chats.refetch()}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        )}
        {chats.isSuccess && visible.length === 0 && (
          <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
            <MessageCircle className="size-10 text-brand/50" />
            <h3 className="font-medium">
              {search
                ? "No matching conversations"
                : filter === "unread"
                  ? "You’re all caught up"
                  : "Your people. Your conversations."}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {search
                ? "Try another name."
                : filter === "unread"
                  ? "No unread conversations right now."
                  : "Start a chat and send your first signal."}
            </p>
            {!search && filter === "all" && (
              <Button onClick={() => setOpen(true)}>
                <Plus />
                New conversation
              </Button>
            )}
          </div>
        )}
        <nav aria-label="Conversations" className="flex flex-col gap-1">
          {visible.map((chat) => {
            const title = chat.isGroup
              ? chat.name || "Group"
              : displayName(chat.participants[0]?.user);
            const lastMessage = chat.messages?.[0];
            const typists = typing.filter((entry) => entry.chatId === chat.id);
            const typingText = typists.length
              ? chat.isGroup
                ? `${typists.map((entry) => entry.username || "Someone").join(", ")} is typing`
                : "is typing"
              : "";
            return (
              <NavLink
                key={chat.id}
                to={`/dashboard/websocket/${chat.id}`}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition-colors ${isActive ? "border-primary/25 bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]" : "border-transparent hover:border-border hover:bg-muted/60"}`
                }
              >
                <IdentityAvatar
                  avatarId={
                    chat.isGroup
                      ? chat.avatarId
                      : chat.participants[0]?.user.profile?.avatarId
                  }
                  name={title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {chat.isGroup && (
                        <Users className="mr-1 inline size-3.5" />
                      )}
                      {title}
                    </span>
                    {lastMessage && (
                      <time
                        className="shrink-0 text-[10px] text-muted-foreground"
                        dateTime={lastMessage.createdAt}
                      >
                        {formatDateBasedOnToday(lastMessage.createdAt)}
                      </time>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-xs leading-5 ${typingText ? "text-brand" : "text-muted-foreground"}`}
                      title={typingText || undefined}
                      aria-live="polite"
                      dir="auto"
                    >
                      {typingText ||
                        lastMessage?.content ||
                        (lastMessage?.attachments?.length
                          ? lastMessage.attachments[0].kind === "VIDEO"
                            ? "Video"
                            : lastMessage.attachments[0].kind === "AUDIO"
                              ? "Voice message"
                              : "Photo"
                          : "Start the conversation")}
                    </p>
                    {!!chat._count?.messages && (
                      <span
                        aria-label={`${chat._count.messages} unread messages`}
                        className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                      >
                        {chat._count.messages}
                      </span>
                    )}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
