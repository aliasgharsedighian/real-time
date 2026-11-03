import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck, SendIcon } from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDateBasedOnToday } from "@/shared/lib/date";
import { errorMessage } from "@/shared/lib/api";
import NotFoundPage from "@/pages/NotFoundPage";
import { chatKeys, getHistory } from "./api";
import { useChatRoom } from "./hooks/use-chat-room";

export default function ChatPage() {
  const { chatId } = useParams();
  const id = Number(chatId);
  if (!Number.isSafeInteger(id) || id <= 0) return <NotFoundPage />;
  return <ChatRoom key={id} chatId={id} />;
}

function ChatRoom({ chatId }: { chatId: number }) {
  const { user } = useSession();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const history = useQuery({
    queryKey: chatKeys.history(identity, chatId),
    queryFn: ({ signal }) => getHistory(chatId, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const room = useChatRoom(chatId, history.isSuccess);
  const [input, setInput] = useState(
    () => sessionStorage.getItem(`beam-draft:${user?.id}:${chatId}`) ?? "",
  );
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const initialized = useRef(false);
  const messages = history.data?.messages;
  const lastMessageId = messages?.at(-1)?.id;
  const firstUnread = messages?.find(
    (message) =>
      message.senderId !== user?.id &&
      history.data?.unreadIds.includes(message.id),
  )?.id;
  useEffect(() => {
    const key = `beam-draft:${user?.id}:${chatId}`;
    if (input) sessionStorage.setItem(key, input);
    else sessionStorage.removeItem(key);
  }, [input, chatId, user?.id]);
  useEffect(() => {
    if (!messages?.length) return;
    if (!initialized.current || nearBottom.current)
      bottom.current?.scrollIntoView?.({
        behavior: initialized.current ? "smooth" : "instant",
      });
    initialized.current = true;
  }, [lastMessageId, messages?.length]);

  async function submit() {
    if (!input.trim() || pending) return;
    const text = input;
    setPending(true);
    setSendError("");
    try {
      await room.send(text);
      setInput((current) => (current === text ? "" : current));
      nearBottom.current = true;
      bottom.current?.scrollIntoView?.({ behavior: "smooth" });
    } catch (error) {
      setSendError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  if (history.isPending)
    return (
      <div role="status" className="space-y-6 p-6">
        <span className="sr-only">Loading messages</span>
        {[1, 2, 3, 4].map((id) => (
          <Skeleton
            key={id}
            className={`h-16 w-2/3 ${id % 2 ? "" : "ml-auto"}`}
          />
        ))}
      </div>
    );
  if (history.isError)
    return (
      <div className="space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold">
          Unable to load this conversation
        </h1>
        <p role="alert">{errorMessage(history.error)}</p>
        <Button onClick={() => void history.refetch()}>Try again</Button>
      </div>
    );

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
      aria-label="Chat room"
    >
      {!room.connected && (
        <p role="status" className="bg-muted px-4 py-2 text-center text-sm">
          Connecting… Your draft is saved on this device.
        </p>
      )}
      <div className="min-h-6 px-4 text-sm text-blue-600" aria-live="polite">
        {room.typing.length === 1
          ? `${room.typing[0].username || "Someone"} is typing…`
          : room.typing.length > 1
            ? `${room.typing.length} people are typing…`
            : ""}
      </div>
      <div
        ref={container}
        onScroll={() => {
          const element = container.current;
          if (element)
            nearBottom.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              100;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        role="log"
        aria-label="Messages"
        aria-live="polite"
      >
        {messages?.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            Start the conversation with a message.
          </p>
        )}
        {messages?.map((message) => {
          const own = message.senderId === user?.id;
          const read = message.readStatuses?.some(
            (receipt) => receipt.userId !== user?.id,
          );
          return (
            <div key={message.id}>
              {message.id === firstUnread && (
                <p className="my-4 border-t pt-2 text-center text-xs text-muted-foreground">
                  Unread messages
                </p>
              )}
              <div
                className={`mb-3 flex ${own ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`flex max-w-[85%] items-start gap-2 ${own ? "" : "flex-row-reverse"}`}
                >
                  <img
                    className="size-8 rounded-full bg-muted p-1"
                    src={
                      own
                        ? "/assets/icons/people-user-team.png"
                        : "/assets/icons/user-icon.png"
                    }
                    alt=""
                  />
                  <div
                    className={`flex min-w-0 flex-col gap-1 ${own ? "items-start" : "items-end"}`}
                  >
                    <time
                      className="text-[11px] text-muted-foreground"
                      dateTime={message.createdAt}
                    >
                      {formatDateBasedOnToday(message.createdAt)}
                    </time>
                    <div
                      className={`flex items-end gap-2 rounded-b-xl px-3 py-2.5 text-sm ${own ? "rounded-tr-xl bg-blue-500 text-white" : "rounded-tl-xl bg-muted text-foreground"}`}
                    >
                      <span
                        className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                        dir="auto"
                      >
                        {message.content}
                      </span>
                      {own && (
                        <span aria-label={read ? "Read" : "Sent"}>
                          {read ? (
                            <CheckCheck className="size-3" />
                          ) : (
                            <Check className="size-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className="shrink-0 border-t"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="message-input" className="sr-only">
          Message
        </label>
        <textarea
          id="message-input"
          className="block min-h-20 w-full resize-none p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          dir="auto"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            room.startTyping();
          }}
          onBlur={room.stopTyping}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Write your message…"
        />
        {sendError && (
          <p role="alert" className="px-3 py-2 text-sm text-destructive">
            {sendError}
          </p>
        )}
        <div className="flex items-center justify-end border-t px-3 py-2">
          <Button
            type="submit"
            aria-label="Send message"
            disabled={!input.trim() || pending || !room.connected}
          >
            {pending ? "Sending…" : <SendIcon />}
          </Button>
        </div>
      </form>
    </section>
  );
}
