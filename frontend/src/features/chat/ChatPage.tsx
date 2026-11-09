import { ReactionChips } from "./components/ReactionPicker";
import { MessageReaders } from "./components/MessageReaders";
import { UserInfoDialog } from "./components/UserInfoDialog";
import {
  applyReactionUpdate,
  keepLatestReactions,
  removeMessagesFromHistory,
} from "./message-cache";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSessionStore } from "@/features/auth/session-store";
import {
  chatKeys,
  deleteMessages,
  editMessage,
  forwardMessages,
  getPinnedMessages,
  setMessagePin,
  setMessageReaction,
} from "./api";
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
import { VoiceMessage } from "./components/VoicePlayback";
import { MessagePhotos, PhotoGallery } from "@/features/uploads/PhotoGallery";
import {
  maxAlbumPhotos,
  PhotoPreview,
  UploadingMedia,
  UploadingPhotos,
  type SelectedPhoto,
} from "./components/PhotoPreview";
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
  PinnedMessageBar,
  PinnedMessagesView,
} from "./components/PinnedMessages";
import {
  ChatDateNavigation,
  DaySeparator,
} from "./components/ChatDateNavigation";
import { useChatRoom } from "./hooks/use-chat-room";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useVoiceRecorder } from "./hooks/use-voice-recorder";
const EmojiPicker = lazy(() => import("./components/ChatEmojiPicker"));

type PhotoBatch = {
  photos: Map<number, SelectedPhoto>;
  active?: { key: number; controller: AbortController };
};

export default function ChatPage() {
  const { chatId } = useParams();
  const id = Number(chatId);
  if (!Number.isSafeInteger(id) || id <= 0) return <NotFoundPage />;
  return <ChatRoom key={id} chatId={id} />;
}

function ChatRoom({ chatId }: { chatId: number }) {
  const { user } = useSession();
  const history = useChatHistory(chatId, user?.id);
  const room = useChatRoom(chatId, history.isSuccess && !history.opening);
  const [input, setInput] = useState(
    () => sessionStorage.getItem(`beam-draft:${user?.id}:${chatId}`) ?? "",
  );
  const cache = useQueryClient();
  const pendingReactions = useRef(new Set<number>());
  const pendingPins = useRef(new Set<number>());
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const pins = useQuery({
    queryKey: chatKeys.pins(identity, chatId),
    queryFn: ({ signal }) => getPinnedMessages(chatId, signal),
    enabled: history.isSuccess,
  });
  const [pinsOpen, setPinsOpen] = useState(false);
  const pinListTrigger = useRef<HTMLButtonElement>(null);
  const refreshPins = useCallback(async () => {
    const queryKey = chatKeys.pins(identity, chatId);
    await cache.cancelQueries({ queryKey });
    await cache.invalidateQueries({ queryKey });
  }, [cache, identity, chatId]);
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
      void refreshPins();
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
      if (message.chatId !== chatId) return;
      if (message.pinnedAt) void refreshPins();
      setReply((current) => (current?.id === message.id ? message : current));
    };
    const pinsChanged = (event: { chatId: number }) => {
      if (event.chatId === chatId) void refreshPins();
    };
    const reconnected = () => void refreshPins();
    socket.on("message:pins", pinsChanged);
    socket.on("connect", reconnected);
    socket.on("message:updated", updated);
    socket.on("message:deleted", deleted);
    return () => {
      socket.off("message:pins", pinsChanged);
      socket.off("connect", reconnected);
      socket.off("message:updated", updated);
      socket.off("message:deleted", deleted);
    };
  }, [chatId, editing, refreshPins]);
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
  const [uploading, setUploading] = useState<{ file: File; caption: string }>();
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoPreview, setPhotoPreview] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoBatch = useRef<PhotoBatch | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [groupPhotos, setGroupPhotos] = useState(true);
  const [photoError, setPhotoError] = useState("");
  const photoKey = useRef(0);
  const sourceDraft = useRef("");
  const [gallery, setGallery] = useState<{
    photos: MediaFile[];
    index: number;
    trigger: HTMLButtonElement;
  }>();
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
  useEffect(
    () => () => {
      uploadController.current?.abort();
      photoBatch.current?.active?.controller.abort();
    },
    [],
  );
  const [pending, setPending] = useState(false);
  const messages = history.opening ? undefined : history.data?.messages;
  const [unreadBoundary, setUnreadBoundary] = useState<{ id?: number }>();
  // Capture the divider once for this room visit, independently of live receipts.
  if (messages && !unreadBoundary) {
    setUnreadBoundary({
      id: messages.find((message) =>
        history.data?.unreadIds.includes(message.id),
      )?.id,
    });
  }
  const firstUnread = unreadBoundary?.id;
  const unreadCount =
    history.data?.unreadCount ?? history.data?.unreadIds.length ?? 0;
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
    firstUnread,
  });
  const composerGestures = useComposerGestures(textarea, () => {
    nearBottom.current = false;
  });

  async function focusMessage(id: number, align?: "start") {
    await history.openMessage(id);
    setFocusedMessage((current) => ({
      id,
      requestId: (current?.requestId ?? 0) + 1,
      align,
    }));
  }

  async function jumpToPin(id: number) {
    try {
      await focusMessage(id);
      setPinsOpen(false);
      requestAnimationFrame(() =>
        container.current?.focus({ preventScroll: true }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function togglePin(messageId: number, pinned: boolean) {
    if (pendingPins.current.has(messageId)) return;
    pendingPins.current.add(messageId);
    try {
      await setMessagePin(chatId, messageId, !pinned);
      await refreshPins();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      pendingPins.current.delete(messageId);
    }
  }
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }, [input, history.isPending]);
  useEffect(() => {
    const key = `beam-draft:${user?.id}:${chatId}`;
    if (editing) return;
    if (input) sessionStorage.setItem(key, input);
    else sessionStorage.removeItem(key);
  }, [input, chatId, user?.id, editing]);

  async function reactToMessage(message: Message, emoji: string) {
    if (!user || pendingReactions.current.has(message.id)) return;
    pendingReactions.current.add(message.id);
    const selected = message.reactions?.find(
      (reaction) => reaction.userId === user.id,
    )?.emoji;
    try {
      const update = await setMessageReaction(
        chatId,
        message.id,
        selected === emoji ? null : emoji,
      );
      cache.setQueryData<History>(chatKeys.history(identity, chatId), (old) =>
        applyReactionUpdate(old, update),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      pendingReactions.current.delete(message.id);
    }
  }

  function addPhotos(files: File[]) {
    if (!policy.data) return;
    try {
      if (photos.length + files.length > maxAlbumPhotos)
        throw new Error(`Choose up to ${maxAlbumPhotos} photos at a time.`);
      for (const photo of files) {
        validateUpload(photo, policy.data);
        if (!policy.data.imageMimeTypes.includes(photo.type))
          throw new Error(
            "Choose only photos for an album, or attach one video or audio file.",
          );
      }
      const added = files.map((file) => ({ file, key: photoKey.current++ }));
      setPhotos((current) => [...current, ...added]);
      setPhotoError("");
      setSendError("");
      if (!photos.length) {
        sourceDraft.current = input;
        setPhotoCaption(input);
        setGroupPhotos(true);
        setPhotoPreview(true);
      }
    } catch (error) {
      (photoPreview ? setPhotoError : setSendError)(errorMessage(error));
    }
  }

  function removePhoto(photo: SelectedPhoto) {
    if (photo.uploaded) void discardFile(photo.uploaded.id).catch(() => {});
    setPhotos((current) => current.filter((item) => item.key !== photo.key));
    setPhotoError("");
    if (photos.length === 1) setPhotoPreview(false);
  }

  function cancelPhotoUpload(key: number) {
    const batch = photoBatch.current;
    const photo = batch?.photos.get(key);
    if (!batch || !photo || photo.sending) return;
    batch.photos.delete(key);
    if (batch.active?.key === key) batch.active.controller.abort();
    if (photo.uploaded) void discardFile(photo.uploaded.id).catch(() => {});
    setPhotos([...batch.photos.values()]);
  }

  function closePhotoPreview() {
    for (const photo of photos)
      if (photo.uploaded) void discardFile(photo.uploaded.id).catch(() => {});
    setPhotoPreview(false);
    setPhotos([]);
  }

  async function uploadAttachment(
    file: File,
    caption: string,
    signal: AbortSignal,
  ) {
    if (!policy.data)
      throw new Error("Upload settings are unavailable. Please try again.");
    validateUpload(file, policy.data);
    setUploading({ file, caption });
    setProgress(0);
    try {
      const uploaded = await uploadFile<MediaFile>(
        `files/chats/${chatId}`,
        file,
        signal,
        setProgress,
      );
      signal.throwIfAborted();
      return uploaded;
    } finally {
      setUploading(undefined);
    }
  }

  function showSentMessage() {
    if (history.data?.window) {
      setFocusedMessage(undefined);
      void history.returnToLatest();
    }
    scrollToBottom();
  }

  async function sendPhotos() {
    if (!photos.length || pending || photoBatch.current || !room.connected)
      return;
    const request = new AbortController();
    const multiple = photos.length > 1;
    const batch: PhotoBatch = {
      photos: new Map(
        photos.map((photo) => [
          photo.key,
          { ...photo, progress: undefined, sending: false },
        ]),
      ),
    };
    photoBatch.current = batch;
    uploadController.current = request;
    setPending(true);
    setPhotoPreview(false);
    setUploadingPhotos(multiple);
    setPhotoError("");
    setSendError("");
    let caption = photoCaption;
    let replyId = reply?.id;
    let sent = false;
    const draft = sourceDraft.current;
    const refreshPhotos = () => setPhotos([...batch.photos.values()]);
    const updatePhoto = (key: number, update: Partial<SelectedPhoto>) => {
      const current = batch.photos.get(key);
      if (!current) return;
      batch.photos.set(key, { ...current, ...update });
      refreshPhotos();
    };
    const clearSentCaption = () => {
      setInput((current) => (current === draft ? "" : current));
      setPhotoCaption("");
      if (reply)
        setReply((current) => (current?.id === reply.id ? undefined : current));
    };
    try {
      scrollToBottom();
      refreshPhotos();
      for (const { key } of photos) {
        request.signal.throwIfAborted();
        const photo = batch.photos.get(key);
        if (!photo) continue;
        let uploaded = photo.uploaded;
        if (!uploaded && multiple) {
          const controller = new AbortController();
          batch.active = { key, controller };
          updatePhoto(key, { progress: 0 });
          try {
            uploaded = await uploadFile<MediaFile>(
              `files/chats/${chatId}`,
              photo.file,
              controller.signal,
              (progress) => {
                if (!controller.signal.aborted) updatePhoto(key, { progress });
              },
            );
          } catch (error) {
            if (controller.signal.aborted && !request.signal.aborted) continue;
            throw error;
          } finally {
            batch.active = undefined;
          }
          if (controller.signal.aborted) {
            void discardFile(uploaded.id).catch(() => {});
            continue;
          }
        }
        uploaded ??= await uploadAttachment(photo.file, caption, request.signal);
        updatePhoto(key, { uploaded });
        if (!groupPhotos) {
          updatePhoto(key, { sending: true });
          await room.send(caption, uploaded.id, replyId);
          if (!sent) clearSentCaption();
          sent = true;
          batch.photos.delete(key);
          refreshPhotos();
          caption = "";
          replyId = undefined;
        }
      }
      if (groupPhotos && batch.photos.size) {
        request.signal.throwIfAborted();
        const ids: string[] = [];
        for (const photo of batch.photos.values()) {
          if (photo.uploaded) ids.push(photo.uploaded.id);
          batch.photos.set(photo.key, { ...photo, sending: true });
        }
        refreshPhotos();
        await room.send(caption, ids.length === 1 ? ids[0] : ids, replyId);
        sent = true;
        batch.photos.clear();
        refreshPhotos();
        clearSentCaption();
      }
    } catch (error) {
      if (!request.signal.aborted) setPhotoError(errorMessage(error));
    } finally {
      photoBatch.current = null;
      if (sent && !request.signal.aborted) showSentMessage();
      setUploadingPhotos(false);
      setPending(false);
      if (batch.photos.size) setPhotoPreview(true);
    }
  }

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
                      ? keepLatestReactions(updated, m)
                      : m.replyToId === updated.id
                        ? { ...m, replyTo: updated }
                        : m,
                  ),
                }
              : old,
        );
        cancelEdit();
        if (updated.pinnedAt) void refreshPins();
        void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
        return;
      }
      let attachment = uploaded;
      const request = new AbortController();
      uploadController.current = request;
      if (file && !attachment) {
        scrollToBottom();
        attachment = await uploadAttachment(file, text, request.signal);
        setUploaded(attachment);
      }
      if (request.signal.aborted) return;
      if (reply) await room.send(text, attachment?.id, reply.id);
      else await room.send(text, attachment?.id);
      setReply(undefined);
      setFile(undefined);
      setUploaded(undefined);
      setInput((current) => (current === text ? "" : current));
      showSentMessage();
    } catch (error) {
      if (!uploadController.current?.signal.aborted)
        setSendError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  if (history.isPending || history.opening)
    return <BrandLoading message="Loading messages…" />;
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

  const latestPin = pins.data?.[0];
  const pinnedIds = new Set(pins.data?.map((message) => message.id));
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <section
        className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden chat-scene ${pinsOpen ? "hidden" : "flex"}`}
        aria-label="Chat room"
      >
        {latestPin && (
          <PinnedMessageBar
            message={latestPin}
            busy={history.navigating}
            listTrigger={pinListTrigger}
            onJump={(id) => void jumpToPin(id)}
            onOpen={() => {
              search.setOpen(false);
              setPinsOpen(true);
            }}
          />
        )}
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
              onSelect={(id) => focusMessage(id, "start")}
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
                const sender = own
                  ? user
                  : (message.sender ??
                    history.data?.users.find(
                      (participant) => participant.userId === message.senderId,
                    )?.user);
                const photos =
                  message.attachments?.filter(
                    (file) => file.kind === "IMAGE",
                  ) ?? [];
                const ownReaction = message.reactions?.find(
                  (reaction) => reaction.userId === user?.id,
                )?.emoji;
                const pinned = pins.data
                  ? pinnedIds.has(message.id)
                  : !!message.pinnedAt;
                const pickReaction = (emoji: string) =>
                  void reactToMessage(message, emoji);
                return (
                  <Fragment key={message.id}>
                    {separator}
                    {message.id === firstUnread && (
                      <p
                        data-unread-for={message.id}
                        className="my-4 border-t pt-2 text-center text-xs text-muted-foreground"
                      >
                        Unread messages
                      </p>
                    )}
                    <div
                      data-message-id={message.id}
                      data-message-day={day}
                      ref={
                        index === Math.min(9, messages.length - 1)
                          ? prefetch
                          : undefined
                      }
                    >
                      <div
                        className={`mb-4 flex ${selected.length ? "pl-8" : ""} ${own ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex max-w-[88%] items-end gap-2 sm:max-w-[75%] ${own ? "flex-row-reverse" : ""}`}
                        >
                          <IdentityAvatar
                            avatarId={sender?.profile?.avatarId}
                            name={displayName(sender)}
                            className="hidden size-7 text-[10px] sm:inline-flex"
                          />
                          <div
                            className={`flex min-w-0 flex-col gap-1 ${own ? "items-end" : "items-start"}`}
                          >
                            {history.data?.chat?.isGroup && !own && (
                              <span className="text-xs font-semibold text-brand">
                                {displayName(sender)}
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
                              pinned={pinned}
                              onPin={() => void togglePin(message.id, pinned)}
                              onReact={pickReaction}
                              ownReaction={ownReaction}
                            >
                              <div
                                className={`message-bubble flex flex-col gap-2 rounded-2xl text-sm leading-6 shadow-sm ${photos.length ? "px-1 py-1 [&>*:not([data-photo-grid])]:mx-2" : "px-4 py-3"} ${own ? "message-own" : "message-incoming"}`}
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
                                        await focusMessage(message.replyTo!.id);
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
                                <MessagePhotos
                                  photos={photos}
                                  open={(index, trigger) =>
                                    setGallery({ photos, index, trigger })
                                  }
                                />
                                {message.attachments
                                  ?.filter((file) => file.kind !== "IMAGE")
                                  .map((attachment) =>
                                    attachment.kind === "AUDIO" ? (
                                      <VoiceMessage
                                        key={attachment.id}
                                        file={attachment}
                                        messageId={message.id}
                                        sender={displayName(sender)}
                                      />
                                    ) : (
                                      <Media key={attachment.id} file={attachment} />
                                    ),
                                  )}
                                {!!message.content && (
                                  <span
                                    className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                                    dir="auto"
                                  >
                                    {message.content}
                                  </span>
                                )}
                                <div className="flex items-end gap-2">
                                  <ReactionChips
                                    reactions={message.reactions}
                                    selected={ownReaction}
                                    selecting={selected.length > 0}
                                    onPick={pickReaction}
                                  />
                                  <div className="ml-auto flex shrink-0 items-center gap-1 text-[10px] leading-4 whitespace-nowrap text-muted-foreground">
                                    {message.editedAt && <span>edited</span>}
                                    <time dateTime={message.createdAt}>
                                      {formatMessageTime(message.createdAt)}
                                    </time>
                                    {own && (
                                      <MessageReaders
                                        message={message}
                                        compact
                                      />
                                    )}
                                  </div>
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
              {uploading && (
                <UploadingMedia
                  file={uploading.file}
                  caption={uploading.caption}
                  progress={progress}
                  cancel={() => uploadController.current?.abort()}
                />
              )}
              {uploadingPhotos && photos.length > 0 && (
                <UploadingPhotos
                  photos={photos}
                  caption={photoCaption}
                  cancel={cancelPhotoUpload}
                />
              )}
              <div ref={bottom} />
            </div>
          </div>
          {(!atBottom || !!history.data?.window?.afterId || unreadCount > 0) && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Go to latest messages"
              aria-description={
                unreadCount > 0 ? `${unreadCount} unread messages` : undefined
              }
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
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-2 left-1/2 min-w-6 -translate-x-1/2 rounded-full border border-card bg-primary px-1.5 py-0.5 text-xs font-bold leading-4 text-primary-foreground tabular-nums"
                >
                  {unreadCount}
                </span>
              )}
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
          {(file || uploaded) && !uploading && (
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
          <input
            ref={picker}
            type="file"
            multiple
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
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              const chosen = files[0];
              if (!chosen || !policy.data) return;
              if (
                files.length > 1 ||
                policy.data.imageMimeTypes.includes(chosen.type)
              ) {
                addPhotos(files);
                return;
              }
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
            <div className="flex min-w-0 flex-1 items-end rounded-md border border-input bg-background/80 pr-1 shadow-inner focus-within:ring-2 focus-within:ring-ring">
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
      {photoPreview && photos.length > 0 && (
        <PhotoPreview
          photos={photos}
          mimeTypes={policy.data?.imageMimeTypes ?? []}
          grouped={groupPhotos}
          caption={photoCaption}
          error={photoError}
          connected={room.connected}
          onGroup={setGroupPhotos}
          onCaption={setPhotoCaption}
          onAdd={addPhotos}
          onRemove={(key) => {
            const photo = photos.find((item) => item.key === key);
            if (photo) removePhoto(photo);
          }}
          onClose={closePhotoPreview}
          onSend={() => void sendPhotos()}
        />
      )}
      {gallery && (
        <PhotoGallery
          photos={gallery.photos}
          initialIndex={gallery.index}
          trigger={gallery.trigger}
          onClose={() => setGallery(undefined)}
        />
      )}
      <ConfirmDelete
        open={deleting.length > 0}
        onClose={() => setDeleting([])}
        description={`Permanently delete ${deleting.length} message(s) for everyone? This cannot be undone.`}
        onConfirm={async () => {
          await deleteMessages(chatId, deleting);
          void refreshPins();
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
      {pinsOpen && (
        <PinnedMessagesView
          messages={pins.data ?? []}
          busy={history.navigating}
          onJump={(id) => void jumpToPin(id)}
          onClose={() => {
            setPinsOpen(false);
            requestAnimationFrame(() =>
              (pinListTrigger.current ?? container.current)?.focus({
                preventScroll: true,
              }),
            );
          }}
        />
      )}
      {search.open && !pinsOpen && (
        <MessageSearchPanel
          chatId={chatId}
          title={
            history.data?.chat?.isGroup
              ? history.data.chat.name || "This group"
              : displayName(history.data?.users[0]?.user)
          }
          selectedId={focusedMessage?.id}
          onSelect={focusMessage}
        />
      )}
    </div>
  );
}
