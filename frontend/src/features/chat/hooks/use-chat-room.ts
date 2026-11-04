import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { displayName } from "@/shared/lib/types";
import { chatKeys } from "../api";
import { getSocket } from "../socket";
import { applyReceipt, mergeMessages } from "../message-cache";
import type { History, Message, ReadReceipt, TypingEvent } from "../types";

export function useChatRoom(chatId: number, enabled: boolean) {
  const { user } = useSession();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<Record<number, TypingEvent>>({});
  const ownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id;
  const username = displayName(user);

  useEffect(() => {
    if (!enabled || !userId) return;
    const socket = getSocket();
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const key = chatKeys.history(identity, chatId);
    let hasJoined = false;
    const markRead = (ids: number[]) => {
      if (
        document.visibilityState === "visible" &&
        socket.connected &&
        ids.length
      ) {
        for (let offset = 0; offset < ids.length; offset += 1000)
          socket.emit("message:read", {
            chatId,
            userId,
            messageIds: ids.slice(offset, offset + 1000),
          });
      }
    };
    const readLoaded = () => {
      const data = cache.getQueryData<History>(key);
      markRead(
        data?.messages
          .filter(
            (message) =>
              message.senderId !== userId &&
              (!message.kind || message.kind === "TEXT"),
          )
          .map((message) => message.id) ?? [],
      );
    };
    const join = () => {
      setConnected(true);
      socket.emit("chat:join", { chatId, userId });
      if (hasJoined) void cache.invalidateQueries({ queryKey: key });
      hasJoined = true;
    };
    const joined = (payload: { chatId: number }) => {
      if (payload.chatId === chatId) readLoaded();
    };
    const disconnected = () => {
      setConnected(false);
      setTyping({});
    };
    const onMessage = (message: Message) => {
      if (message.chatId !== chatId) return;
      cache.setQueryData<History>(key, (old) =>
        old
          ? { ...old, messages: mergeMessages(old.messages, [message]) }
          : old,
      );
      if (
        message.senderId !== userId &&
        (!message.kind || message.kind === "TEXT")
      )
        markRead([message.id]);
    };
    const onReceipt = (receipt: ReadReceipt) => {
      cache.setQueryData<History>(key, (old) =>
        old ? { ...old, messages: applyReceipt(old.messages, receipt) } : old,
      );
    };
    const onStop = (payload: TypingEvent) => {
      if (payload.chatId !== chatId) return;
      clearTimeout(timers.get(payload.userId));
      timers.delete(payload.userId);
      setTyping((old) => {
        const next = { ...old };
        delete next[payload.userId];
        return next;
      });
    };
    const onStart = (payload: TypingEvent) => {
      if (payload.chatId !== chatId || payload.userId === userId) return;
      clearTimeout(timers.get(payload.userId));
      setTyping((old) => ({ ...old, [payload.userId]: payload }));
      timers.set(
        payload.userId,
        setTimeout(() => onStop(payload), 6000),
      );
    };
    const onError = (payload: { message?: string }) =>
      toast.error(payload.message || "Chat request failed.");
    socket.on("connect", join);
    socket.on("disconnect", disconnected);
    socket.on("chat:joined", joined);
    socket.on("message:new", onMessage);
    socket.on("message:read", onReceipt);
    socket.on("typing:start", onStart);
    socket.on("typing:stop", onStop);
    socket.on("error", onError);
    // A reconnect can finish joining before refreshed history arrives.
    const unsubscribe = cache.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "success" &&
        !event.action.manual &&
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
      if (ownTimer.current) clearTimeout(ownTimer.current);
      for (const timer of timers.values()) clearTimeout(timer);
      if (socket.connected) {
        socket.emit("typing:stop", { chatId, userId, username });
        socket.emit("chat:leave", { chatId, userId });
      }
      socket.off("connect", join);
      socket.off("disconnect", disconnected);
      socket.off("chat:joined", joined);
      socket.off("message:new", onMessage);
      socket.off("message:read", onReceipt);
      socket.off("typing:start", onStart);
      socket.off("typing:stop", onStop);
      socket.off("error", onError);
      unsubscribe();
      document.removeEventListener("visibilitychange", readLoaded);
    };
  }, [chatId, userId, username, identity, enabled, cache]);

  const stopTyping = useCallback(() => {
    if (ownTimer.current) clearTimeout(ownTimer.current);
    const socket = getSocket();
    if (socket.connected)
      socket.emit("typing:stop", { chatId, userId, username });
  }, [chatId, userId, username]);

  function startTyping() {
    const socket = getSocket();
    if (!socket.connected) return;
    socket.emit("typing:start", { chatId, userId, username });
    if (ownTimer.current) clearTimeout(ownTimer.current);
    ownTimer.current = setTimeout(stopTyping, 2000);
  }

  async function send(content: string, attachmentId?: string) {
    const socket = getSocket();
    if (!socket.connected || !userId)
      throw new Error("You are offline. Your message has not been sent.");
    let message: Message;
    try {
      message = await socket.timeout(8000).emitWithAck("message:send", {
        chatId,
        senderId: userId,
        content,
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
      old ? { ...old, messages: mergeMessages(old.messages, [message]) } : old,
    );
    void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
    stopTyping();
  }
  return {
    connected,
    typing: Object.values(typing),
    startTyping,
    stopTyping,
    send,
  };
}
