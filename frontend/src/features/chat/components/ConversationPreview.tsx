import { useCallback, useMemo, type ReactNode } from "react";
import { Content } from "@radix-ui/react-dialog";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { Media } from "@/features/uploads/Media";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatMessageTime } from "@/shared/lib/date";
import { displayName } from "@/shared/lib/types";
import { useMessageScroll } from "../hooks/use-message-scroll";
import { getHistory } from "../api";
import type { Chat } from "../types";

export function ConversationPreview({
  chat,
  onClose,
  actions,
}: {
  chat: Chat;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const { user } = useSession();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const history = useInfiniteQuery({
    // The room observes its own cache to send read receipts.
    queryKey: ["conversation-preview", identity, chat.id],
    queryFn: ({ pageParam, signal }) => getHistory(chat.id, signal, pageParam),
    initialPageParam: 1,
    getPreviousPageParam: (first) => first.nextPage ?? undefined,
    getNextPageParam: () => undefined,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const loaded = !!history.data;
  const firstUnreadId = history.data?.pages.at(-1)?.firstUnreadId;
  const messages = useMemo(() => {
    if (!history.data) return undefined;
    const all = history.data.pages.flatMap((page) => page.messages);
    return [...new Map(all.map((message) => [message.id, message])).values()];
  }, [history.data]);
  const { fetchPreviousPage } = history;
  const loadOlder = useCallback(async () => {
    await fetchPreviousPage({ cancelRefetch: false });
  }, [fetchPreviousPage]);
  const { container, content, prefetch, handleScroll, scrollToBottom } =
    useMessageScroll({
      messages,
      firstUnread: firstUnreadId ?? undefined,
      loadingOlder: history.isFetchingPreviousPage,
      canLoadOlder:
        history.hasPreviousPage &&
        !history.isFetching &&
        !history.isFetchPreviousPageError,
      loadOlder,
    });

  const peer = chat.participants[0]?.user;
  const title = chat.isGroup ? chat.name || "Group" : displayName(peer);
  const unread =
    history.data?.pages.at(-1)?.unreadCount ?? chat._count?.messages ?? 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-background/45 backdrop-blur-md" />
        <Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-1/2 z-50 mx-auto flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg -translate-y-1/2 flex-col gap-2 outline-none"
        >
          <section className="chat-scene flex h-[min(62dvh,34rem)] min-h-0 flex-col overflow-hidden rounded-3xl border border-border shadow-2xl">
            <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 py-2">
              <IdentityAvatar
                name={title}
                avatarId={
                  chat.isGroup ? chat.avatarId : peer?.profile?.avatarId
                }
                className="size-9"
              />
              <DialogTitle className="min-w-0 flex-1 truncate text-sm">
                {title}
              </DialogTitle>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close preview">
                  <X />
                </Button>
              </DialogClose>
            </header>
            <div className="relative min-h-0 flex-1">
              <div
                ref={container}
                onScroll={handleScroll}
                tabIndex={0}
                role="region"
                aria-label="Preview messages"
                className="h-full overflow-y-auto overscroll-contain px-4 pt-3 pb-14 [overflow-anchor:none]"
              >
                <div ref={content} className="space-y-2">
                  {history.isPending && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Loading messages…
                    </p>
                  )}
                  {history.isError && !loaded && (
                    <Button
                      variant="outline"
                      onClick={() => void history.refetch()}
                    >
                      Retry preview
                    </Button>
                  )}
                  {history.hasPreviousPage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={history.isFetchingPreviousPage}
                      onClick={() => void loadOlder()}
                    >
                      {history.isFetchingPreviousPage
                        ? "Loading earlier messages…"
                        : history.isFetchPreviousPageError
                          ? "Retry earlier messages"
                          : "Load earlier messages"}
                    </Button>
                  )}
                  {loaded && !messages?.length && (
                    <p className="text-sm text-muted-foreground">
                      No messages yet.
                    </p>
                  )}
                  {messages?.map((message, index) => {
                    const anchorRef =
                      index === Math.min(9, messages.length - 1)
                        ? prefetch
                        : undefined;
                    const own = message.senderId === user?.id;
                    if (message.kind && message.kind !== "TEXT")
                      return (
                        <p
                          key={message.id}
                          data-message-id={message.id}
                          ref={anchorRef}
                          className="text-center text-xs text-muted-foreground"
                        >
                          {message.content}
                        </p>
                      );
                    return (
                      <div
                        key={message.id}
                        data-message-id={message.id}
                        ref={anchorRef}
                        className="space-y-2"
                      >
                        {message.id === firstUnreadId && (
                          <p
                            data-unread-for={message.id}
                            className="rounded-md bg-primary/10 py-1 text-center text-xs text-brand"
                          >
                            Unread messages
                          </p>
                        )}
                        <div
                          className={`flex ${own ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] min-w-0 space-y-1 rounded-2xl px-3 py-2 text-sm ${own ? "message-own" : "message-incoming"}`}
                          >
                            {chat.isGroup && !own && (
                              <p className="text-xs font-semibold text-brand">
                                {displayName(message.sender)}
                              </p>
                            )}
                            {message.attachments?.map((file) => (
                              <Media key={file.id} file={file} />
                            ))}
                            <p
                              dir="auto"
                              className="whitespace-pre-wrap [overflow-wrap:anywhere]"
                            >
                              {message.content}
                            </p>
                            <time
                              dateTime={message.createdAt}
                              className="block text-right text-[10px] text-muted-foreground"
                            >
                              {formatMessageTime(message.createdAt)}
                            </time>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {!!messages?.length && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Go to latest preview messages"
                  className="absolute right-3 bottom-3 rounded-full border border-border shadow"
                  onClick={scrollToBottom}
                >
                  {!!unread && (
                    <span
                      aria-label={`${unread} unread messages`}
                      className="absolute -top-3 rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
                    >
                      {unread}
                    </span>
                  )}
                  <ChevronDown />
                </Button>
              )}
            </div>
          </section>
          {actions && (
            <div className="self-end rounded-2xl border border-border bg-popover p-1 shadow-xl">
              {actions}
            </div>
          )}
        </Content>
      </DialogPortal>
    </Dialog>
  );
}
