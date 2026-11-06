import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
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
import type { History, Message, ReadReceipt } from "../types";

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
    let hasJoined = false;
    const acknowledged = new Set<number>();
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
      markRead(
        data?.messages
          .filter(
            (message) =>
              visibility.ids.has(message.id) &&
              message.senderId !== userId &&
              (!message.kind || message.kind === "TEXT"),
          )
          .map((message) => message.id) ?? [],
      );
    };
    const visibility = observeVisibleMessages(
      document.querySelector<HTMLElement>(
        '[role="log"][aria-label="Messages"]',
      ),
      readLoaded,
    );
    const join = () => {
      acknowledged.clear();
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
      cache.setQueryData<History>(key, (old) =>
        old && !old.window?.afterId
          ? { ...old, messages: mergeMessages(old.messages, [message]) }
          : old,
      );
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
      cache.setQueryData<History>(key, (old) =>
        old ? removeMessagesFromHistory(old, payload.messageIds) : old,
      );
    };
    const onReceipt = (receipt: ReadReceipt) => {
      void cache.invalidateQueries({
        queryKey: chatKeys.readers(identity, chatId, receipt.messageId),
      });
      cache.setQueryData<History>(key, (old) =>
        old ? { ...old, messages: applyReceipt(old.messages, receipt) } : old,
      );
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
    if (socket.connected) join();
    else socket.connect();
    return () => {
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
    attachmentId?: string,
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
        ...(attachmentId ? { attachmentId } : {}),
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
