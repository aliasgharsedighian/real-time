import { Media, LocalPreview } from "@/features/uploads/Media";
import {
  discardFile,
  uploadFile,
  useUploadPolicy,
  validateUpload,
  type MediaFile,
} from "@/features/uploads/api";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  CheckCheck,
  SendIcon,
  Paperclip,
  X,
  Mic,
  Smile,
} from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { formatDateBasedOnToday } from "@/shared/lib/date";
import { errorMessage } from "@/shared/lib/api";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName } from "@/shared/lib/types";
import NotFoundPage from "@/pages/NotFoundPage";
import { chatKeys, getHistory } from "./api";
import { useChatRoom } from "./hooks/use-chat-room";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useVoiceRecorder } from "./hooks/use-voice-recorder";
const EmojiPicker = lazy(() => import("./components/ChatEmojiPicker"));

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
  const policy = useUploadPolicy();
  const [file, setFile] = useState<File>();
  const [uploaded, setUploaded] = useState<MediaFile>();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const voice = useVoiceRecorder({
    maxSeconds: policy.data?.audioMaxSeconds ?? 300,
    maxBytes: policy.data?.audioMaxBytes ?? 20 * 1024 * 1024,
    onReady: (recording) => {
      setFile(recording);
      setUploaded(undefined);
      setSendError("");
    },
    onError: setSendError,
  });
  const hasMessage = !!(input.trim() || file || uploaded);
  const picker = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  const [pending, setPending] = useState(false);
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
    if (
      (!input.trim() && !file && !uploaded) ||
      pending ||
      voice.active ||
      !room.connected
    )
      return;
    const text = input;
    setPending(true);
    setSendError("");
    try {
      let attachment = uploaded;
      const request = new AbortController();
      uploadController.current = request;
      if (file && !attachment) {
        if (!policy.data)
          throw new Error("Upload settings are unavailable. Please try again.");
        validateUpload(file, policy.data);
        setUploading(true);
        setProgress(0);
        try {
          attachment = await uploadFile<MediaFile>(
            `files/chats/${chatId}`,
            file,
            request.signal,
            setProgress,
          );
          if (request.signal.aborted) return;
          setUploaded(attachment);
        } finally {
          setUploading(false);
        }
      }
      if (request.signal.aborted) return;
      await room.send(text, attachment?.id);
      setFile(undefined);
      setUploaded(undefined);
      setInput((current) => (current === text ? "" : current));
      nearBottom.current = true;
      bottom.current?.scrollIntoView?.({ behavior: "smooth" });
    } catch (error) {
      if (!uploadController.current?.signal.aborted)
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden chat-scene"
      aria-label="Chat room"
    >
      {!room.connected && (
        <p role="status" className="bg-muted px-4 py-2 text-center text-sm">
          Connecting… Your draft is saved on this device.
        </p>
      )}
      <div className="min-h-6 px-4 text-sm text-brand" aria-live="polite">
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
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
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
                className={`mb-4 flex ${own ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[88%] items-end gap-2 sm:max-w-[75%] ${own ? "flex-row-reverse" : ""}`}
                >
                  <IdentityAvatar
                    avatarId={
                      (own
                        ? user
                        : (message.sender ??
                          history.data?.users.find(
                            (p) => p.userId === message.senderId,
                          )?.user)
                      )?.profile?.avatarId
                    }
                    name={displayName(
                      own
                        ? user
                        : (message.sender ??
                            history.data?.users.find(
                              (participant) =>
                                participant.userId === message.senderId,
                            )?.user),
                    )}
                    className="hidden size-7 text-[10px] sm:inline-flex"
                  />
                  <div
                    className={`flex min-w-0 flex-col gap-1 ${own ? "items-end" : "items-start"}`}
                  >
                    <time
                      className="text-[11px] text-muted-foreground"
                      dateTime={message.createdAt}
                    >
                      {formatDateBasedOnToday(message.createdAt)}
                    </time>
                    <div
                      className={`flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${own ? "rounded-br-sm message-own" : "rounded-bl-sm message-incoming"}`}
                    >
                      {message.attachments?.map((attachment) => (
                        <Media key={attachment.id} file={attachment} />
                      ))}
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
        className="relative shrink-0 border-t border-border bg-card/90 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {(file || uploaded) && (
          <div className="mb-3 flex items-start gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0 flex-1">
              {file ? (
                <LocalPreview file={file} />
              ) : (
                uploaded && <Media file={uploaded} />
              )}
              {file?.type.startsWith("audio/") && (
                <p className="mt-2 text-sm">
                  Listen to your voice message, then send or discard it.
                </p>
              )}
              <p className="mt-1 truncate text-xs">
                {file?.name || "Attachment ready"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label="Remove attachment"
              onClick={() => {
                if (uploaded) void discardFile(uploaded.id).catch(() => {});
                setFile(undefined);
                setUploaded(undefined);
              }}
            >
              <X />
            </Button>
          </div>
        )}
        {uploading && (
          <div role="status" className="mb-2 text-sm">
            <progress
              value={progress}
              max={100}
              aria-label="Upload progress"
              className="w-full"
            />
            <p>
              {progress < 100
                ? `Uploading… ${progress}%`
                : "Processing attachment…"}
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => uploadController.current?.abort()}
            >
              Cancel upload
            </Button>
          </div>
        )}
        <input
          ref={picker}
          type="file"
          className="sr-only"
          aria-label="Choose chat photo, video or audio"
          disabled={pending || voice.active || !policy.data}
          accept={
            policy.data
              ? [
                  ...policy.data.imageMimeTypes,
                  ...policy.data.videoMimeTypes,
                  ...(policy.data.audioMimeTypes ?? []),
                ].join(",")
              : ""
          }
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = "";
            if (!chosen || !policy.data) return;
            try {
              validateUpload(chosen, policy.data);
              if (uploaded) void discardFile(uploaded.id).catch(() => {});
              setFile(chosen);
              setUploaded(undefined);
              setSendError("");
            } catch (error) {
              setSendError(errorMessage(error));
            }
          }}
        />
        {voice.active && (
          <div
            role="status"
            className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <span className="flex items-center gap-2">
              <Mic className="size-4 animate-pulse text-destructive" />
              {voice.status === "requesting"
                ? "Allow microphone access, then hold again if released."
                : voice.status === "stopping"
                  ? "Preparing voice preview…"
                  : `Recording ${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")} · Release to preview`}
            </span>
            <Button type="button" variant="ghost" onClick={voice.cancel}>
              Cancel recording
            </Button>
          </div>
        )}
        <label htmlFor="message-input" className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12 shrink-0"
            aria-label="Attach photo, video or audio"
            disabled={pending || voice.active || !policy.data}
            onClick={() => picker.current?.click()}
          >
            <Paperclip />
          </Button>
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-12 shrink-0"
                aria-label="Choose emoji"
                disabled={pending || voice.active}
              >
                <Smile />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-[min(350px,calc(100vw-24px))] overflow-hidden p-0"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                textarea.current?.focus();
              }}
            >
              <Suspense
                fallback={
                  <p role="status" className="p-4">
                    Loading emojis…
                  </p>
                }
              >
                {emojiOpen && (
                  <EmojiPicker
                    onSelect={(emoji) => {
                      const element = textarea.current;
                      const start = element?.selectionStart ?? input.length;
                      const end = element?.selectionEnd ?? input.length;
                      const next =
                        input.slice(0, start) + emoji + input.slice(end);
                      if (next.length > 10000) return;
                      setInput(next);
                      room.startTyping();
                      requestAnimationFrame(() => {
                        element?.focus();
                        element?.setSelectionRange(
                          start + emoji.length,
                          start + emoji.length,
                        );
                      });
                    }}
                  />
                )}
              </Suspense>
            </PopoverContent>
          </Popover>
          <textarea
            ref={textarea}
            id="message-input"
            rows={1}
            maxLength={10000}
            disabled={pending || voice.active}
            className="block min-h-12 max-h-36 min-w-0 w-full flex-1 resize-y rounded-2xl border border-input bg-background/80 px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
          {hasMessage ? (
            <Button
              type="submit"
              size="icon"
              className="brand-cta size-12 shrink-0 rounded-full"
              aria-label="Send message"
              disabled={pending || voice.active || !room.connected}
            >
              {pending ? (
                <span className="animate-pulse text-xs">…</span>
              ) : (
                <SendIcon />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className="brand-cta size-12 shrink-0 touch-none select-none rounded-full"
              aria-label="Hold to record voice message"
              title="Hold to record, release to preview"
              aria-pressed={voice.active}
              disabled={
                pending || !room.connected || !policy.data?.audioMimeTypes
              }
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setEmojiOpen(false);
                setSendError("");
                void voice.start();
              }}
              onPointerUp={voice.stop}
              onPointerCancel={voice.cancel}
              onLostPointerCapture={voice.stop}
              onKeyDown={(event) => {
                if (event.key === "Escape") voice.cancel();
                if (
                  (event.key === " " || event.key === "Enter") &&
                  !event.repeat
                ) {
                  event.preventDefault();
                  setSendError("");
                  void voice.start();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  voice.stop();
                }
              }}
            >
              <Mic />
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {policy.data
            ? `Photos up to ${policy.data.imageMaxBytes / 1024 / 1024} MB · Videos up to ${policy.data.videoMaxBytes / 1024 / 1024} MB / ${policy.data.videoMaxSeconds / 60} min · Hold mic to record voice`
            : "Loading upload settings…"}
        </p>
        {policy.isError && (
          <Button
            type="button"
            variant="link"
            onClick={() => void policy.refetch()}
          >
            Retry upload settings
          </Button>
        )}
        {sendError && (
          <p role="alert" className="px-1 pt-2 text-sm text-destructive">
            {sendError}
          </p>
        )}
      </form>
    </section>
  );
}
