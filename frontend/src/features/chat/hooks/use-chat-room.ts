import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { playAppSound } from "@/shared/lib/app-sounds";
import { displayName } from "@/shared/lib/types";
import { observeVisibleMessages } from "./observe-visible-messages";
import { chatKeys } from "../api";
import { getSocket } from "../socket";
import {
  applyReceipt,
  keepLatestReactions,
  mergeMessages,
  removeMessagesFromHistory,
} from "../message-cache";
import type { Chat, History, Message, ReadReceipt } from "../types";

export function useChatRoom(chatId: number, enabled: boolean) {
  const { user } = useSession();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);
  const composing = useRef(false);
  const userId = user?.id;
  const username = displayName(user);

  useEffect(() => {
    if (!enabled || !userId) return;
    const socket = getSocket();
    const key = chatKeys.history(identity, chatId);
    const root = document.querySelector<HTMLElement>(
      '[role="log"][aria-label="Messages"]',
    );
    let hasJoined = false;
    let active = true;
    let readingThrough = false;
    let readThroughId: number | undefined;
    const acknowledged = new Set<number>();
    const receivedOutsideWindow = new Set<number>();
    const updateUnread = (update: (history: History) => History) => {
      const previous = cache.getQueryData<History>(key);
      if (!previous) return;
      const next = update(previous);
      cache.setQueryData(key, next);
      const unreadCount = next.unreadCount ?? next.unreadIds.length;
      if (unreadCount === (previous.unreadCount ?? previous.unreadIds.length))
        return;
      cache.setQueryData<Chat[]>(chatKeys.list(identity), (chats) =>
        chats?.map((chat) =>
          chat.id === chatId
            ? { ...chat, _count: { ...chat._count, messages: unreadCount } }
            : chat,
        ),
      );
    };
    const markRead = (ids: number[]) => {
      if (
        document.visibilityState === "visible" &&
        socket.connected &&
        ids.length
      ) {
        const unread = ids.filter((id) => !acknowledged.has(id));
        for (const id of unread) acknowledged.add(id);
        for (let offset = 0; offset < unread.length; offset += 1000)
          socket.emit("message:read", {
            chatId,
            userId,
            messageIds: unread.slice(offset, offset + 1000),
          });
      }
    };
    const readLoaded = () => {
      const data = cache.getQueryData<History>(key);
      if (readingThrough) return;
      const last = data?.messages.at(-1);
      if (
        data &&
        last &&
        !data.window?.afterId &&
        (data.unreadCount ?? data.unreadIds.length) > 0 &&
        last.id !== readThroughId &&
        root &&
        root.clientHeight > 0 &&
        (visibility.ids.has(last.id) ||
          root.scrollHeight - root.scrollTop - root.clientHeight <= 24) &&
        root.querySelector(`[data-message-id="${last.id}"]`) &&
        socket.connected &&
        document.visibilityState === "visible"
      ) {
        readingThrough = true;
        void socket
          .timeout(8000)
          .emitWithAck("message:read-through", {
            chatId,
            throughMessageId: last.id,
          })
          .then((result: { unreadCount?: number }) => {
            const unreadCount = result?.unreadCount;
            if (typeof unreadCount !== "number" || !Number.isSafeInteger(unreadCount))
              return;
            readThroughId = last.id;
            if (!active) {
              void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
              return;
            }
            updateUnread((old) => {
              const after = new Set(
                old.messages
                  .filter(
                    (message) =>
                      message.createdAt > last.createdAt ||
                      (message.createdAt === last.createdAt && message.id > last.id),
                  )
                  .map((message) => message.id),
              );
              const unreadIds = old.unreadIds.filter((id) => after.has(id));
              return {
                ...old,
                unreadIds,
                unreadCount: Math.max(unreadCount, unreadIds.length),
              };
            });
          })
          .catch(() => {})
          .finally(() => {
            readingThrough = false;
            if (active && readThroughId === last.id) readLoaded();
          });
        return;
      }
      markRead(
        data?.messages
          .filter(
            (message) =>
              visibility.ids.has(message.id) &&
              message.senderId !== userId &&
              !message.readStatuses?.some((receipt) => receipt.userId === userId) &&
              (!message.kind || message.kind === "TEXT"),
          )
          .map((message) => message.id) ?? [],
      );
    };
    const visibility = observeVisibleMessages(root, readLoaded);
    const join = () => {
      acknowledged.clear();
      readThroughId = undefined;
      setConnected(true);
      socket.emit("chat:join", { chatId, userId });
      if (hasJoined) void cache.invalidateQueries({ queryKey: key });
      hasJoined = true;
    };
    const joined = (payload: { chatId: number }) => {
      if (payload.chatId !== chatId) return;
      readLoaded();
      if (composing.current)
        socket.emit("typing:start", { chatId, userId, username });
    };
    const disconnected = () => {
      setConnected(false);
    };
    const onMessage = (message: Message) => {
      if (message.chatId !== chatId) return;
      const incoming =
        message.senderId !== userId && (!message.kind || message.kind === "TEXT");
      updateUnread((old) => {
        const added =
          incoming &&
          !receivedOutsideWindow.has(message.id) &&
          !old.messages.some((entry) => entry.id === message.id);
        if (added && old.window?.afterId) receivedOutsideWindow.add(message.id);
        return {
          ...old,
          messages: old.window?.afterId
            ? old.messages
            : mergeMessages(old.messages, [message]),
          unreadIds:
            added && !old.window?.afterId
              ? [...old.unreadIds, message.id]
              : old.unreadIds,
          unreadCount: (old.unreadCount ?? old.unreadIds.length) + Number(added),
        };
      });
    };
    const updated = (message: Message) => {
      if (message.chatId !== chatId) return;
      cache.setQueryData<History>(key, (old) =>
        old
          ? {
              ...old,
              messages: old.messages.map((m) =>
                m.id === message.id
                  ? keepLatestReactions(message, m)
                  : m.replyToId === message.id
                    ? { ...m, replyTo: message }
                    : m,
              ),
            }
          : old,
      );
    };
    const deleted = (payload: { chatId: number; messageIds: number[] }) => {
      if (payload.chatId !== chatId) return;
      updateUnread((old) => {
        const next = removeMessagesFromHistory(old, payload.messageIds);
        const removedOutsideWindow = payload.messageIds.filter(
          (id) => receivedOutsideWindow.delete(id) && !old.unreadIds.includes(id),
        );
        return {
          ...next,
          unreadCount: Math.max(
            0,
            (next.unreadCount ?? 0) - removedOutsideWindow.length,
          ),
        };
      });
    };
    const onReceipt = (receipt: ReadReceipt) => {
      void cache.invalidateQueries({
        queryKey: chatKeys.readers(identity, chatId, receipt.messageId),
      });
      updateUnread((old) => {
        const read =
          receipt.userId === userId &&
          (old.unreadIds.includes(receipt.messageId) ||
            receivedOutsideWindow.has(receipt.messageId));
        if (read) receivedOutsideWindow.delete(receipt.messageId);
        return {
          ...old,
          messages: applyReceipt(old.messages, receipt),
          unreadIds: read
            ? old.unreadIds.filter((id) => id !== receipt.messageId)
            : old.unreadIds,
          unreadCount: Math.max(
            0,
            (old.unreadCount ?? old.unreadIds.length) - Number(read),
          ),
        };
      });
    };
    const onError = (payload: { message?: string }) =>
      toast.error(payload.message || "Chat request failed.");
    socket.on("connect", join);
    socket.on("disconnect", disconnected);
    socket.on("chat:joined", joined);
    socket.on("message:new", onMessage);
    socket.on("message:updated", updated);
    socket.on("message:deleted", deleted);
    socket.on("message:read", onReceipt);
    socket.on("error", onError);
    // A reconnect can finish joining before refreshed history arrives.
    const unsubscribe = cache.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "success" &&
        event.query.queryKey.every(
          (part: unknown, index: number) => part === key[index],
        ) &&
        event.query.queryKey.length === key.length
      )
        readLoaded();
    });
    document.addEventListener("visibilitychange", readLoaded);
    root?.addEventListener("scroll", readLoaded, { passive: true });
    if (socket.connected) join();
    else socket.connect();
    return () => {
      active = false;
      if (socket.connected) {
        socket.emit("typing:stop", { chatId, userId, username });
        socket.emit("chat:leave", { chatId, userId });
      }
      socket.off("connect", join);
      socket.off("disconnect", disconnected);
      socket.off("chat:joined", joined);
      socket.off("message:new", onMessage);
      socket.off("message:updated", updated);
      socket.off("message:deleted", deleted);
      socket.off("message:read", onReceipt);
      socket.off("error", onError);
      unsubscribe();
      visibility.stop();
      document.removeEventListener("visibilitychange", readLoaded);
      root?.removeEventListener("scroll", readLoaded);
    };
  }, [chatId, userId, username, identity, enabled, cache]);

  const stopTyping = useCallback(() => {
    composing.current = false;
    if (!enabled || !userId) return;
    const socket = getSocket();
    if (socket.connected)
      socket.emit("typing:stop", { chatId, userId, username });
  }, [chatId, userId, username, enabled]);

  const startTyping = useCallback(() => {
    composing.current = true;
    if (!enabled || !userId) return;
    const socket = getSocket();
    if (!socket.connected) return;
    socket.emit("typing:start", { chatId, userId, username });
  }, [chatId, userId, username, enabled]);

  async function send(
    content: string,
    attachment?: string | string[],
    replyToId?: number,
  ) {
    const socket = getSocket();
    if (!socket.connected || !userId)
      throw new Error("You are offline. Your message has not been sent.");
    let message: Message;
    try {
      message = await socket.timeout(8000).emitWithAck("message:send", {
        chatId,
        senderId: userId,
        content,
        ...(replyToId ? { replyToId } : {}),
        ...(Array.isArray(attachment)
          ? { attachmentIds: attachment }
          : attachment
            ? { attachmentId: attachment }
            : {}),
      });
    } catch {
      throw new Error(
        "No delivery confirmation received. Check the conversation before sending again.",
      );
    }
    if (!message?.id)
      throw new Error(
        (message as unknown as { message?: string })?.message ||
          "The server did not accept your message.",
      );
    if (useSessionStore.getState().tokens?.refreshToken === identity) playAppSound("messageSent");
    cache.setQueryData<History>(chatKeys.history(identity, chatId), (old) =>
      old && !old.window?.afterId
        ? { ...old, messages: mergeMessages(old.messages, [message]) }
        : old,
    );
    void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
    stopTyping();
  }
  return {
    connected,
    startTyping,
    stopTyping,
    send,
  };
}
