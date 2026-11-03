import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, getChats } from "../api";
import { getSocket } from "../socket";

export function useChatList() {
  const { user } = useSession();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: chatKeys.list(identity),
    queryFn: () => getChats(user!.id),
    enabled: !!user,
    // The backend only broadcasts inside open chat rooms; refresh the inbox for other rooms.
    refetchInterval: 10_000,
    retry: 1,
  });
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
    };
    socket.on("connect", refresh);
    socket.on("message:new", refresh);
    socket.on("message:read", refresh);
    return () => {
      socket.off("connect", refresh);
      socket.off("message:new", refresh);
      socket.off("message:read", refresh);
    };
  }, [cache, identity]);
  return query;
}
