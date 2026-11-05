import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck, ChevronLeft } from "lucide-react";
import { useSessionStore } from "@/features/auth/session-store";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { errorMessage } from "@/shared/lib/api";
import { chatKeys, getMessageReaders } from "../api";
import type { Message, MessageReader } from "../types";

function readerName(reader: MessageReader) {
  return (
    [reader.user.profile?.firstname, reader.user.profile?.lastname]
      .filter(Boolean)
      .join(" ") ||
    reader.user.email ||
    `User #${reader.userId}`
  );
}
const readTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function MessageReaders({
  message,
  compact = false,
}: {
  message: Message;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const readers = useQuery({
    queryKey: chatKeys.readers(identity, message.chatId, message.id),
    queryFn: ({ signal }) =>
      getMessageReaders(message.chatId, message.id, signal),
    enabled: !compact || open,
    staleTime: 0,
    retry: false,
    refetchInterval: open ? 10_000 : false,
  });
  const count =
    readers.data?.length ??
    new Set(
      message.readStatuses
        ?.filter((r) => r.userId !== message.senderId)
        .map((r) => r.userId),
    ).size;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role={compact ? undefined : "menuitem"}
          aria-label={
            compact
              ? `Seen details for message ${message.id}`
              : `${count} Seen · View readers`
          }
          className={
            compact
              ? "rounded p-1 text-inherit outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
              : "flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
          }
        >
          {count ? (
            <CheckCheck
              className={compact ? "size-3.5" : "size-4 shrink-0 text-brand"}
            />
          ) : (
            <Check className={compact ? "size-3.5" : "size-4 shrink-0"} />
          )}
          {!compact && (
            <>
              <span className="min-w-0 flex-1 truncate">
                {readers.isPending
                  ? "Loading seen…"
                  : readers.isError
                    ? "Seen details"
                    : count
                      ? `${count} Seen`
                      : "Not seen yet"}
              </span>
              <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                {readers.data?.slice(0, 4).map((r) => (
                  <span key={r.userId} title={readerName(r)}>
                    <IdentityAvatar
                      avatarId={r.user.profile?.avatarId}
                      name={readerName(r)}
                      className="size-6 border-2 border-popover text-[8px]"
                    />
                  </span>
                ))}
              </span>
              <ChevronLeft className="size-3 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={compact || mobile ? "top" : "left"}
        align="end"
        sideOffset={8}
        collisionPadding={8}
        data-message-menu
        className="w-[min(20rem,calc(100vw-1rem))] p-0"
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <section aria-label="Message readers">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">
              Seen by{readers.data ? ` ${count}` : ""}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              First seen · times in your local timezone
            </p>
          </div>
          <div className="max-h-[min(20rem,50dvh)] overflow-y-auto p-2">
            {readers.isPending && (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                Loading readers…
              </p>
            )}
            {readers.isError && (
              <div className="space-y-2 p-3">
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(readers.error)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void readers.refetch()}
                >
                  Retry readers
                </Button>
              </div>
            )}
            {readers.isSuccess && count === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No one has seen this message yet.
              </p>
            )}
            {readers.data && (
              <ul>
                {readers.data.map((r) => (
                  <li
                    key={r.userId}
                    className="flex items-center gap-3 rounded-lg p-2"
                  >
                    <IdentityAvatar
                      avatarId={r.user.profile?.avatarId}
                      name={readerName(r)}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" dir="auto">
                        {readerName(r)}
                      </p>
                      <time
                        dateTime={r.readAt}
                        title={readTime(r.readAt)}
                        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <CheckCheck className="size-3 shrink-0 text-brand" />
                        {readTime(r.readAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </PopoverContent>
    </Popover>
  );
}
