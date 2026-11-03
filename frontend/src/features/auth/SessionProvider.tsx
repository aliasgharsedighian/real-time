import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "./api";
import { useSessionStore } from "./session-store";
import { SessionContext } from "./session-context";
import { isUnauthorized } from "@/shared/lib/api";
import { disconnectSocket } from "@/features/chat/socket";

export function SessionProvider({ children }: { children: ReactNode }) {
  const tokens = useSessionStore((state) => state.tokens);
  const cache = useQueryClient();
  const previousSession = useRef(tokens?.refreshToken);
  const session = useQuery({
    queryKey: ["session", tokens?.refreshToken],
    queryFn: ({ signal }) => getCurrentUser(signal),
    enabled: !!tokens,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (previousSession.current !== tokens?.refreshToken) {
      disconnectSocket();
      // The session's refresh-token identity also scopes every private query.
      cache.removeQueries({
        predicate: (query) =>
          query.queryKey[0] !== "session" ||
          query.queryKey[1] !== tokens?.refreshToken,
      });
      previousSession.current = tokens?.refreshToken;
    }
  }, [tokens?.refreshToken, cache]);

  useEffect(() => {
    if (session.error && isUnauthorized(session.error))
      useSessionStore.getState().clear();
  }, [session.error]);

  return (
    <SessionContext.Provider
      value={{
        user: tokens ? (session.data ?? null) : null,
        checking: !!tokens && session.isPending,
        error: tokens ? session.error : null,
        retry: () => {
          void session.refetch();
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
