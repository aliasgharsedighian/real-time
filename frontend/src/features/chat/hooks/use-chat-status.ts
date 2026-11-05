import { useEffect, useState } from "react";
import { getSocket } from "../socket";
import type { ChatPresence, UserPresence } from "../presence";
import type { TypingEvent } from "../types";

export function useChatStatus(chatId: number, ownId: number | undefined) {
  const [users, setUsers] = useState<Record<number, UserPresence>>({});
  const [typing, setTyping] = useState<Record<number, TypingEvent>>({});
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      if (socket.connected) socket.emit("chat:presence", { chatId });
    };
    const stop = (event: { chatId: number; userId: number }) => {
      if (event.chatId !== chatId) return;
      setTyping((previous) => {
        const next = { ...previous };
        delete next[event.userId];
        return next;
      });
    };
    const start = (event: TypingEvent) => {
      if (event.chatId !== chatId || event.userId === ownId) return;
      setTyping((previous) => ({ ...previous, [event.userId]: event }));
    };
    const presence = (event: ChatPresence) => {
      if (event.chatId !== chatId) return;
      setUsers((previous) => ({
        ...previous,
        ...Object.fromEntries(event.users.map((user) => [user.userId, user])),
      }));
      for (const user of event.users)
        if (!user.online) stop({ chatId, userId: user.userId });
    };
    const joined = (event: { chatId: number }) => {
      if (event.chatId === chatId) refresh();
    };
    const reset = () => {
      setUsers({});
      setTyping({});
    };
    const connect = () => {
      reset();
      refresh();
    };
    socket.on("connect", connect);
    socket.on("disconnect", reset);
    socket.on("chat:joined", joined);
    socket.on("chat:presence", presence);
    socket.on("typing:start", start);
    socket.on("typing:stop", stop);
    refresh();
    // Refresh coarse private buckets on the server; exact relative times tick locally.
    const poll = setInterval(refresh, 30_000);
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    const visible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        refresh();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      socket.off("connect", connect);
      socket.off("disconnect", reset);
      socket.off("chat:joined", joined);
      socket.off("chat:presence", presence);
      socket.off("typing:start", start);
      socket.off("typing:stop", stop);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [chatId, ownId]);
  return { users, typing: Object.values(typing), now };
}
