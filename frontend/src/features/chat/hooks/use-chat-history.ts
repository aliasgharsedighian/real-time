import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, getHistory } from "../api";
import { mergeMessages } from "../message-cache";
import type { History } from "../types";

// Keep one normalized cache for the room, header, receipts and live messages.
export function useChatHistory(chatId: number) {
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const key = chatKeys.history(identity, chatId);
  const request = useRef<AbortController | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  useEffect(() => () => request.current?.abort(), [chatId, identity]);
  const history = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const latest = await getHistory(chatId, signal);
      const old = cache.getQueryData<History>(key);
      return old
        ? {
            ...latest,
            messages: mergeMessages(old.messages, latest.messages),
            unreadIds: [...new Set([...old.unreadIds, ...latest.unreadIds])],
            nextPage: old.nextPage,
          }
        : latest;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const loadOlder = useCallback(async () => {
    const historyKey = chatKeys.history(identity, chatId);
    const page = cache.getQueryData<History>(historyKey)?.nextPage;
    if (!page || request.current || history.isFetching) return;
    const controller = new AbortController();
    request.current = controller;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const older = await getHistory(chatId, controller.signal, page);
      if (controller.signal.aborted) return;
      cache.setQueryData<History>(historyKey, (old) =>
        old
          ? {
              ...old,
              messages: mergeMessages(older.messages, old.messages),
              unreadIds: [...new Set([...old.unreadIds, ...older.unreadIds])],
              nextPage: older.nextPage,
            }
          : old,
      );
    } catch (error) {
      if (!controller.signal.aborted) setOlderError(error);
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setLoadingOlder(false);
      }
    }
  }, [cache, chatId, identity, history.isFetching]);
  return { ...history, loadOlder, loadingOlder, olderError };
}
