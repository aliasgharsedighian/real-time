import { useEffect, useRef, type Ref } from "react";
import { ArrowLeft, CircleArrowRight, List, Pin } from "lucide-react";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Button } from "@/shared/ui/button";
import {
  formatMessageDay,
  formatMessageTime,
  localDateKey,
} from "@/shared/lib/date";
import { displayName } from "@/shared/lib/types";
import { messageSummary } from "./MessageActions";
import type { PinnedMessage } from "../types";

export function PinnedMessageBar({
  message,
  busy,
  listTrigger,
  onJump,
  onOpen,
}: {
  message: PinnedMessage;
  busy: boolean;
  listTrigger: Ref<HTMLButtonElement>;
  onJump: (id: number) => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1.5 sm:px-5">
      <button
        type="button"
        onClick={() => onJump(message.id)}
        disabled={busy}
        className="min-w-0 flex-1 rounded-sm border-l-2 border-primary px-2 text-left hover:bg-muted/60"
      >
        <span className="block text-xs font-semibold text-brand">
          Pinned message
        </span>
        <span
          dir="auto"
          className="block truncate text-sm text-muted-foreground"
        >
          {messageSummary(message)}
        </span>
      </button>
      <Button
        ref={listTrigger}
        variant="ghost"
        size="icon"
        aria-label="View all pinned messages"
        aria-controls="pinned-messages-view"
        onClick={onOpen}
      >
        <Pin />
        <List className="-ml-1 size-3" />
      </Button>
    </div>
  );
}

export function PinnedMessagesView({
  messages,
  busy,
  onClose,
  onJump,
}: {
  messages: PinnedMessage[];
  busy: boolean;
  onClose: () => void;
  onJump: (id: number) => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus({ preventScroll: true }), []);
  return (
    <section
      id="pinned-messages-view"
      aria-labelledby="pinned-messages-title"
      className="flex min-h-0 min-w-0 flex-1 flex-col chat-scene"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card p-3">
        <Button
          ref={back}
          size="icon"
          variant="ghost"
          aria-label="Back to conversation"
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
        <h2 id="pinned-messages-title" className="font-semibold">
          {messages.length} pinned{" "}
          {messages.length === 1 ? "message" : "messages"}
        </h2>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-3 sm:p-5">
        {!messages.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No pinned messages
          </p>
        )}
        <ul className="mx-auto max-w-3xl space-y-3">
          {messages.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onJump(message.id)}
                className="group flex w-full items-center gap-3 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70"
              >
                <div className="message-bubble message-incoming flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-3 shadow-sm">
                  <IdentityAvatar
                    avatarId={message.sender?.profile?.avatarId}
                    name={displayName(message.sender)}
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand">
                      {displayName(message.sender)}
                    </p>
                    <p
                      dir="auto"
                      className="line-clamp-4 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]"
                    >
                      {messageSummary(message)}
                    </p>
                    <time
                      dateTime={message.createdAt}
                      className="mt-1 block text-xs text-muted-foreground"
                    >
                      {formatMessageDay(localDateKey(message.createdAt))} ·{" "}
                      {formatMessageTime(message.createdAt)}
                    </time>
                  </div>
                </div>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground group-hover:text-brand">
                  <CircleArrowRight className="size-5" />
                  <span className="sr-only">Go to message</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
