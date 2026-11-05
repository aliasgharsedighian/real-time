import { workerMessage } from "@/features/notifications/browser-push";
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
    // Tokens and the push installation are browser-wide; logout/account switching
    // in another tab must also stop this tab from restoring its old push binding.
    const syncSession = (event: StorageEvent) => {
      if (event.key !== "beam-session-v1") return;
      try {
        const restored = event.newValue ? JSON.parse(event.newValue)?.state?.tokens : null;
        if (typeof restored?.accessToken === "string" && typeof restored?.refreshToken === "string") {
          const current = useSessionStore.getState().tokens;
          if (current?.accessToken !== restored.accessToken || current?.refreshToken !== restored.refreshToken)
            useSessionStore.getState().setTokens(restored);
        } else useSessionStore.getState().clear();
      } catch { useSessionStore.getState().clear(); }
    };
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  useEffect(() => {
    if (!tokens) void workerMessage({ type: "notification:bind", userId: null, enabled: false }).catch(() => {});
  }, [tokens]);

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
