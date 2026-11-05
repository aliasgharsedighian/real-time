import { MessageReaders } from "./components/MessageReaders";
import { UserInfoDialog } from "./components/UserInfoDialog";
import { removeMessagesFromHistory } from "./message-cache";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, deleteMessages, editMessage, forwardMessages } from "./api";
import type { History, Message } from "./types";
import { ConfirmDelete } from "./components/ChatActions";
import {
  MessageInteraction,
  ForwardDialog,
  messageSummary,
} from "./components/MessageActions";
import { getSocket } from "./socket";
import { Reply, Pencil, Forward, Trash2 } from "lucide-react";
import { Media, LocalPreview } from "@/features/uploads/Media";
import {
  discardFile,
  uploadFile,
  useUploadPolicy,
  validateUpload,
  type MediaFile,
} from "@/features/uploads/api";
import {
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { SendIcon, Paperclip, X, Mic, Smile, ChevronDown } from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/shared/ui/button";
import { BrandLoading } from "@/shared/components/BrandLoading";
import { formatMessageTime, localDateKey } from "@/shared/lib/date";
import { errorMessage } from "@/shared/lib/api";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName } from "@/shared/lib/types";
import NotFoundPage from "@/pages/NotFoundPage";
import { useChatHistory } from "./hooks/use-chat-history";
import { useComposerGestures } from "./hooks/use-composer-gestures";
import { useMessageScroll } from "./hooks/use-message-scroll";
import { useMessageSearch } from "./message-search-context";
import { MessageSearchPanel } from "./components/MessageSearchPanel";
import {
  ChatDateNavigation,
  DaySeparator,
} from "./components/ChatDateNavigation";
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
  const history = useChatHistory(chatId);
  const room = useChatRoom(chatId, history.isSuccess);
  const [input, setInput] = useState(
    () => sessionStorage.getItem(`beam-draft:${user?.id}:${chatId}`) ?? "",
  );
  const cache = useQueryClient();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const [reply, setReply] = useState<Message>();
  const [editing, setEditing] = useState<Message>();
  const savedDraft = useRef("");
  const [selected, setSelected] = useState<number[]>([]);
  const [deleting, setDeleting] = useState<number[]>([]);
  const [forwarding, setForwarding] = useState<number[]>([]);
  const canDeleteSelection =
    selected.length > 0 &&
    selected.every((id) =>
      history.data?.messages.some(
        (m) => m.id === id && m.senderId === user?.id,
      ),
    );
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 100
          ? [...current, id]
          : current,
    );
  function cancelEdit() {
    setEditing(undefined);
    setInput(savedDraft.current);
  }
  useEffect(() => {
    const socket = getSocket();
    const deleted = (event: { chatId: number; messageIds: number[] }) => {
      if (event.chatId !== chatId) return;
      setSelected((current) =>
        current.filter((id) => !event.messageIds.includes(id)),
      );
      setReply((current) =>
        current && event.messageIds.includes(current.id) ? undefined : current,
      );
      if (editing && event.messageIds.includes(editing.id)) {
        setEditing(undefined);
        setInput(savedDraft.current);
      }
    };
    const updated = (message: Message) => {
      if (message.chatId === chatId)
        setReply((current) => (current?.id === message.id ? message : current));
    };
    socket.on("message:updated", updated);
    socket.on("message:deleted", deleted);
    return () => {
      socket.off("message:updated", updated);
      socket.off("message:deleted", deleted);
    };
  }, [chatId, editing]);
  const hasDraft = input.length > 0;
  const { startTyping, stopTyping } = room;
  useEffect(() => {
    if (hasDraft) startTyping();
    else stopTyping();
  }, [hasDraft, startTyping, stopTyping]);
  const policy = useUploadPolicy();
  const [file, setFile] = useState<File>();
  const [uploaded, setUploaded] = useState<MediaFile>();
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mountComposer = useCallback((element: HTMLTextAreaElement | null) => {
    textarea.current = element;
    // Run once when the actual input mounts, including after history loads.
    // A stable ref avoids stealing focus again when messages or drafts change.
    element?.focus({ preventScroll: true });
  }, []);
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
  const messages = history.data?.messages;
  const search = useMessageSearch();
  const [focusedMessage, setFocusedMessage] = useState<{
    id: number;
    requestId: number;
    align?: "start" | "center";
  }>();
  const {
    container,
    content,
    bottom,
    nearBottom,
    atBottom,
    scrollToBottom,
    prefetch,
    visibleDay,
    scrolling,
    handleScroll,
  } = useMessageScroll({
    messages,
    loadingOlder: history.loadingOlder,
    canLoadOlder:
      !!(
        history.data?.window?.beforeId ??
        history.data?.olderCursor ??
        history.data?.nextPage
      ) &&
      !history.olderError &&
      !history.isFetching &&
      !history.navigating,
    loadOlder: history.loadOlder,
    focusMessage: focusedMessage,
  });
  const composerGestures = useComposerGestures(textarea, () => {
    nearBottom.current = false;
  });
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }, [input, history.isPending]);
  const firstUnread = messages?.find(
    (message) =>
      message.senderId !== user?.id &&
      history.data?.unreadIds.includes(message.id),
  )?.id;
  useEffect(() => {
    const key = `beam-draft:${user?.id}:${chatId}`;
    if (editing) return;
    if (input) sessionStorage.setItem(key, input);
    else sessionStorage.removeItem(key);
  }, [input, chatId, user?.id, editing]);

  async function submit() {
    if (
      (!input.trim() && !file && !uploaded && !editing?.attachments?.length) ||
      pending ||
      voice.active ||
      !room.connected
    )
      return;
    const text = input;
    setPending(true);
    setSendError("");
    try {
      if (editing) {
        const updated = await editMessage(chatId, editing.id, text);
        cache.setQueryData<History>(
          chatKeys.history(identity, chatId),
          (old) =>
            old
              ? {
                  ...old,
                  messages: old.messages.map((m) =>
                    m.id === updated.id
                      ? updated
                      : m.replyToId === updated.id
                        ? { ...m, replyTo: updated }
                        : m,
                  ),
                }
              : old,
        );
        cancelEdit();
        void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
        return;
      }
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
      if (reply) await room.send(text, attachment?.id, reply.id);
      else await room.send(text, attachment?.id);
      setReply(undefined);
      if (history.data?.window) {
        setFocusedMessage(undefined);
        void history.returnToLatest();
      }
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
  if (history.isPending) return <BrandLoading message="Loading messages…" />;
  if (history.isError && !history.data)
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
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden chat-scene"
        aria-label="Chat room"
      >
        {!!selected.length && (
          <div
            className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2"
            aria-label="Selected message actions"
          >
            <span className="mr-auto text-sm">{selected.length} selected</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForwarding(selected)}
            >
              <Forward className="size-4" />
              Forward
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canDeleteSelection}
              onClick={() => setDeleting(selected)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Cancel
            </Button>
          </div>
        )}
        {history.data?.window && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-4 py-2 text-xs text-muted-foreground">
            <span>Viewing message history</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={history.navigating}
              onClick={() => {
                setFocusedMessage(undefined);
                nearBottom.current = true;
                void history.returnToLatest();
              }}
            >
              Back to latest messages
            </Button>
          </div>
        )}
        {history.navigating && (
          <BrandLoading compact message="Opening conversation…" />
        )}
        {!!history.navigationError && (
          <p role="alert" className="px-4 py-2 text-xs text-destructive">
            {errorMessage(history.navigationError)}
          </p>
        )}
        {!room.connected && (
          <p role="status" className="bg-muted px-4 py-2 text-center text-sm">
            Connecting… Your draft is saved on this device.
          </p>
        )}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {!!messages?.length && (
            <ChatDateNavigation
              chatId={chatId}
              day={visibleDay || localDateKey(messages.at(-1)!.createdAt)}
              disabled={history.navigating}
              visible={scrolling}
              onSelect={async (id) => {
                await history.openMessage(id);
                setFocusedMessage((current) => ({
                  id,
                  requestId: (current?.requestId ?? 0) + 1,
                  align: "start",
                }));
              }}
            />
          )}
          <div
            ref={container}
            onScroll={handleScroll}
            {...composerGestures}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain overflow-x-hidden px-3 py-4 sm:px-6 [overflow-anchor:none]"
            role="log"
            aria-label="Messages"
            aria-live="polite"
          >
            <div ref={content}>
              {history.loadingOlder ? (
                <BrandLoading compact message="Loading earlier messages…" />
              ) : (history.data?.window?.beforeId ??
                history.data?.olderCursor ??
                history.data?.nextPage) ? (
                <div className="flex flex-col items-center gap-1 py-2">
                  {!!history.olderError && (
                    <p
                      role="alert"
                      className="text-center text-xs text-muted-foreground"
                    >
                      Could not load earlier messages.{" "}
                      {errorMessage(history.olderError)}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      history.isFetching ||
                      history.navigating ||
                      history.loadingNewer
                    }
                    onClick={() => void history.loadOlder()}
                  >
                    {history.olderError ? "Try again" : "Load earlier messages"}
                  </Button>
                </div>
              ) : null}
              {messages?.length === 0 && (
                <p className="py-12 text-center text-muted-foreground">
                  Start the conversation with a message.
                </p>
              )}
              {messages?.map((message, index) => {
                const day = localDateKey(message.createdAt);
                const separator =
                  index === 0 ||
                  localDateKey(messages[index - 1].createdAt) !== day ? (
                    <DaySeparator day={day} />
                  ) : null;
                if (
                  message.kind === "MEMBER_LEFT" ||
                  message.kind === "MEMBER_REMOVED" ||
                  message.kind === "MEMBER_ADDED"
                )
                  return (
                    <Fragment key={message.id}>
                      {separator}
                      <div
                        data-message-id={message.id}
                        data-message-day={day}
                        ref={
                          index === Math.min(9, messages.length - 1)
                            ? prefetch
                            : undefined
                        }
                        className="my-4 flex justify-center"
                        aria-label="Group activity"
                      >
                        <div className="max-w-[90%] rounded-xl border border-border/60 bg-card/80 px-4 py-2 text-center text-xs leading-5 text-muted-foreground">
                          <p
                            dir="auto"
                            className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                          >
                            {message.content}
                          </p>
                          <time
                            dateTime={message.createdAt}
                            className="block text-[10px] opacity-75"
                          >
                            {formatMessageTime(message.createdAt)}
                          </time>
                        </div>
                      </div>
                    </Fragment>
                  );
                const own = message.senderId === user?.id;
                return (
                  <Fragment key={message.id}>
                    {separator}
                    <div
                      data-message-id={message.id}
                      data-message-day={day}
                      ref={
                        index === Math.min(9, messages.length - 1)
                          ? prefetch
                          : undefined
                      }
                    >
                      {message.id === firstUnread && (
                        <p className="my-4 border-t pt-2 text-center text-xs text-muted-foreground">
                          Unread messages
                        </p>
                      )}
                      <div
                        className={`mb-4 flex ${selected.length ? "pl-8" : ""} ${own ? "justify-end" : "justify-start"}`}
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
                            {history.data?.chat?.isGroup && !own && (
                              <span className="text-xs font-semibold text-brand">
                                {displayName(
                                  message.sender ??
                                    history.data.users.find(
                                      (p) => p.userId === message.senderId,
                                    )?.user,
                                )}
                              </span>
                            )}
                            <MessageInteraction
                              message={message}
                              own={own}
                              canDelete={own}
                              selecting={selected.length > 0}
                              selected={selected.includes(message.id)}
                              onToggle={() => toggleSelected(message.id)}
                              onReply={() => {
                                if (editing) cancelEdit();
                                setReply(message);
                                textarea.current?.focus({
                                  preventScroll: true,
                                });
                              }}
                              onEdit={() => {
                                if (!editing) savedDraft.current = input;
                                setReply(undefined);
                                setEditing(message);
                                setInput(message.content);
                                textarea.current?.focus({
                                  preventScroll: true,
                                });
                              }}
                              onDelete={() => setDeleting([message.id])}
                              onForward={() => setForwarding([message.id])}
                            >
                              <div
                                className={`message-bubble flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${own ? "message-own" : "message-incoming"}`}
                              >
                                {message.forwarded && (
                                  <span className="flex items-center gap-1 text-xs text-brand">
                                    <Forward className="size-3" />
                                    {message.forwardedFrom ? (
                                      <UserInfoDialog
                                        userId={message.forwardedFrom.id}
                                        label={`View profile of ${displayName(message.forwardedFrom)}`}
                                      >
                                        Forwarded from{" "}
                                        {displayName(message.forwardedFrom)}
                                      </UserInfoDialog>
                                    ) : (
                                      "Forwarded"
                                    )}
                                  </span>
                                )}
                                {message.replyTo && (
                                  <button
                                    type="button"
                                    className="max-w-full rounded-md border-l-4 border-primary bg-primary/10 px-2 py-1 text-left text-xs"
                                    onClick={async () => {
                                      try {
                                        await history.openMessage(
                                          message.replyTo!.id,
                                        );
                                        setFocusedMessage((current) => ({
                                          id: message.replyTo!.id,
                                          requestId:
                                            (current?.requestId ?? 0) + 1,
                                        }));
                                      } catch (error) {
                                        toast.error(errorMessage(error));
                                      }
                                    }}
                                  >
                                    <span className="block font-semibold text-brand">
                                      {displayName(message.replyTo.sender)}
                                    </span>
                                    <span
                                      className="line-clamp-2 max-w-64 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                                      dir="auto"
                                    >
                                      {messageSummary(message.replyTo)}
                                    </span>
                                  </button>
                                )}
                                {message.attachments?.map((attachment) => (
                                  <Media
                                    key={attachment.id}
                                    file={attachment}
                                  />
                                ))}
                                <span
                                  className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                                  dir="auto"
                                >
                                  {message.content}
                                </span>
                                <div className="flex items-center justify-end gap-1 self-end text-[10px] leading-4 text-muted-foreground">
                                  {message.editedAt && <span>edited</span>}
                                  <time dateTime={message.createdAt}>
                                    {formatMessageTime(message.createdAt)}
                                  </time>
                                  {own && (
                                    <MessageReaders message={message} compact />
                                  )}
                                </div>
                              </div>
                            </MessageInteraction>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
              {history.loadingNewer ? (
                <BrandLoading compact message="Loading newer messages…" />
              ) : history.data?.window?.afterId ? (
                <div className="py-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={history.navigating || history.loadingOlder}
                    onClick={() => void history.loadNewer()}
                  >
                    Load newer messages
                  </Button>
                </div>
              ) : null}
              <div ref={bottom} />
            </div>
          </div>
          {(!atBottom || !!history.data?.window?.afterId) && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Go to latest messages"
              title="Go to latest messages"
              className="absolute right-4 bottom-4 z-10 size-12 animate-in rounded-full border border-border bg-card text-brand shadow-lg fade-in zoom-in-90 duration-150 motion-reduce:animate-none sm:right-6"
              disabled={history.navigating}
              onClick={async () => {
                setFocusedMessage(undefined);
                if (history.data?.window) {
                  nearBottom.current = true;
                  await history.returnToLatest();
                }
                scrollToBottom();
              }}
            >
              <ChevronDown className="size-6" />
            </Button>
          )}
        </div>
        <form
          className="relative max-h-[60%] shrink-0 overflow-y-auto overscroll-y-contain border-t border-border bg-card/90 p-3 pb-[max(.75rem,var(--chat-safe-bottom,env(safe-area-inset-bottom)))]"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {(reply || editing) && (
            <div
              aria-label={editing ? "Edit preview" : "Reply preview"}
              className="mb-2 flex animate-in items-center gap-3 border-b border-border px-1 py-2 text-sm fade-in slide-in-from-bottom-1 duration-150 motion-reduce:animate-none"
            >
              {editing ? (
                <Pencil className="size-4 shrink-0 text-brand" />
              ) : (
                <Reply className="size-4 shrink-0 text-brand" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand">
                  {editing
                    ? "Edit message"
                    : `Reply to ${displayName(reply?.sender)}`}
                </p>
                <p
                  className="line-clamp-2 whitespace-pre-wrap break-words text-sm leading-5 [overflow-wrap:anywhere]"
                  dir="auto"
                >
                  {messageSummary((editing || reply)!)}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={editing ? "Cancel editing" : "Cancel reply"}
                disabled={pending}
                onClick={() => (editing ? cancelEdit() : setReply(undefined))}
              >
                <X />
              </Button>
            </div>
          )}
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
            disabled={pending || voice.active || !!editing || !policy.data}
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
              className="size-11 shrink-0 rounded-full border border-input bg-background/80 text-brand"
              aria-label="Attach photo, video or audio"
              disabled={pending || voice.active || !!editing || !policy.data}
              onClick={() => picker.current?.click()}
            >
              <Paperclip />
            </Button>
            <div className="flex min-w-0 flex-1 items-end rounded-full border border-input bg-background/80 pr-1 shadow-inner focus-within:ring-2 focus-within:ring-ring">
              <textarea
                ref={mountComposer}
                id="message-input"
                rows={1}
                maxLength={10000}
                aria-busy={pending}
                disabled={voice.active}
                className="block min-h-11 max-h-36 min-w-0 w-full flex-1 resize-none bg-transparent px-4 py-2.5 text-base outline-none placeholder:text-muted-foreground"
                dir="auto"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !window.matchMedia("(pointer: coarse)").matches &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                placeholder="Write your message…"
              />
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 rounded-full text-brand"
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
                    textarea.current?.focus({ preventScroll: true });
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
                          requestAnimationFrame(() => {
                            element?.focus({ preventScroll: true });
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
            </div>
            {hasMessage || editing ? (
              <Button
                type="submit"
                onPointerDown={(event) => {
                  if (document.activeElement === textarea.current)
                    event.preventDefault();
                }}
                size="icon"
                className="brand-cta size-11 shrink-0 rounded-full"
                aria-label={editing ? "Save edited message" : "Send message"}
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
                className="brand-cta size-11 shrink-0 touch-none select-none rounded-full"
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
          <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
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
      <ConfirmDelete
        open={deleting.length > 0}
        onClose={() => setDeleting([])}
        description={`Permanently delete ${deleting.length} message(s) for everyone? This cannot be undone.`}
        onConfirm={async () => {
          await deleteMessages(chatId, deleting);
          await cache.cancelQueries({
            queryKey: chatKeys.history(identity, chatId),
          });
          cache.setQueryData<History>(
            chatKeys.history(identity, chatId),
            (old) => (old ? removeMessagesFromHistory(old, deleting) : old),
          );
          setSelected((current) =>
            current.filter((id) => !deleting.includes(id)),
          );
          if (reply && deleting.includes(reply.id)) setReply(undefined);
          if (editing && deleting.includes(editing.id)) cancelEdit();
          void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
        }}
      />
      {forwarding.length > 0 && (
        <ForwardDialog
          open={true}
          count={forwarding.length}
          onClose={() => setForwarding([])}
          onForward={async (target) => {
            await forwardMessages(chatId, forwarding, target);
            setSelected([]);
            void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
            void cache.invalidateQueries({
              queryKey: chatKeys.history(identity, target),
            });
            toast.success("Messages forwarded");
          }}
        />
      )}
      {search.open && (
        <MessageSearchPanel
          chatId={chatId}
          title={
            history.data?.chat?.isGroup
              ? history.data.chat.name || "This group"
              : displayName(history.data?.users[0]?.user)
          }
          selectedId={focusedMessage?.id}
          onSelect={async (id) => {
            await history.openMessage(id);
            setFocusedMessage((current) => ({
              id,
              requestId: (current?.requestId ?? 0) + 1,
            }));
          }}
        />
      )}
    </div>
  );
}
