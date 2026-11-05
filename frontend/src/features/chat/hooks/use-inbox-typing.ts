import { useEffect, useState } from "react";
import { useSession } from "@/features/auth/session-context";
import { getSocket } from "../socket";
import type { TypingEvent } from "../types";

export function useInboxTyping() {
  const { user } = useSession();
  const [entries, setEntries] = useState<Record<string, TypingEvent>>({});
  useEffect(() => {
    const socket = getSocket();
    const key = (entry: TypingEvent) => `${entry.chatId}:${entry.userId}`;
    const start = (entry: TypingEvent) => {
      if (entry.userId !== user?.id)
        setEntries((old) => ({ ...old, [key(entry)]: entry }));
    };
    const stop = (entry: TypingEvent) =>
      setEntries((old) => {
        const next = { ...old };
        delete next[key(entry)];
        return next;
      });
    const snapshot = (values: TypingEvent[]) =>
      setEntries(
        Object.fromEntries(
          values
            .filter((entry) => entry.userId !== user?.id)
            .map((entry) => [key(entry), entry]),
        ),
      );
    const reset = () => setEntries({});
    const refresh = () => {
      if (socket.connected) socket.emit("typing:list");
    };
    socket.on("typing:start", start);
    socket.on("typing:stop", stop);
    socket.on("typing:list", snapshot);
    socket.on("connect", refresh);
    socket.on("disconnect", reset);
    socket.on("chat:updated", refresh);
    refresh();
    return () => {
      socket.off("typing:start", start);
      socket.off("typing:stop", stop);
      socket.off("typing:list", snapshot);
      socket.off("connect", refresh);
      socket.off("disconnect", reset);
      socket.off("chat:updated", refresh);
    };
  }, [user?.id]);
  return Object.values(entries);
}
