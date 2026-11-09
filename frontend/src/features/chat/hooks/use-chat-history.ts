import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, getHistory, getMessageWindow, syncMessages } from "../api";
import {
  mergeMessages,
  preserveReactions,
  removeMessagesFromHistory,
} from "../message-cache";
import type { History, Message } from "../types";

function remainingUnread(ids: number[], messages: Message[], userId?: number) {
  const unread = new Set(ids);
  return messages
    .filter(
      (message) =>
        unread.has(message.id) &&
        message.senderId !== userId &&
        !message.readStatuses?.some((receipt) => receipt.userId === userId),
    )
    .map((message) => message.id);
}

function withPageUnread(
  old: History,
  messages: Message[],
  unreadIds: number[] | undefined,
  userId?: number,
) {
  return {
    messages,
    unreadIds: remainingUnread(
      [...old.unreadIds, ...(unreadIds ?? [])],
      messages,
      userId,
    ),
  };
}

// Keep one normalized cache for the room, header, receipts and live messages.
export function useChatHistory(chatId: number, userId?: number) {
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const key = chatKeys.history(identity, chatId);
  const request = useRef<AbortController | null>(null);
  const opened = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const [navigating, setNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState<unknown>(null);
  const [loadingNewer, setLoadingNewer] = useState(false);
  useEffect(() => () => request.current?.abort(), [chatId, identity]);
  const history = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const latest = await getHistory(chatId, signal);
      let old = cache.getQueryData<History>(key);
      if (!opened.current) {
        const first = latest.firstUnreadId;
        if (first && !latest.messages.some((message) => message.id === first)) {
          const context = await getMessageWindow(
            chatId,
            { aroundId: first },
            signal,
          );
          opened.current = true;
          return {
            ...latest,
            messages: context.messages,
            unreadIds: remainingUnread(
              context.unreadIds ?? [first],
              context.messages,
              userId,
            ),
            nextPage: null,
            window: {
              beforeId: context.beforeId,
              afterId: context.afterId,
              focusId: first,
            },
          };
        }
        if (old?.window) old = undefined;
      }
      let synchronized = old
        ? await syncMessages(
            chatId,
            [
              ...new Set(
                [
                  ...old.messages,
                  ...(old.window?.afterId ? [] : latest.messages),
                ].map((message) => message.id),
              ),
            ],
            signal,
          )
        : [];
      if (old) {
        const current = cache.getQueryData<History>(key);
        synchronized = preserveReactions(synchronized, current?.messages);
        const previous = new Map(
          current?.messages.map((message) => [message.id, message]),
        );
        synchronized = synchronized.map((message) => {
          const receipt = previous
            .get(message.id)
            ?.readStatuses?.find((entry) => entry.userId === userId);
          return receipt &&
            !message.readStatuses?.some((entry) => entry.userId === userId)
            ? {
                ...message,
                readStatuses: [...(message.readStatuses ?? []), receipt],
              }
            : message;
        });
        const existing = new Set(synchronized.map((message) => message.id));
        const removed = old.messages
          .filter((message) => !existing.has(message.id))
          .map((message) => message.id);
        if (removed.length) old = removeMessagesFromHistory(old, removed);
      }
      opened.current = true;
      // A search window has a gap to the latest history. Never join those lists.
      if (old?.window?.afterId)
        return {
          ...old,
          messages: synchronized,
          unreadIds: remainingUnread(old.unreadIds, synchronized, userId),
          unreadCount: latest.unreadCount ?? old.unreadCount,
          chat: latest.chat,
          users: latest.users,
        };
      const latestIds = new Set(latest.messages.map((message) => message.id));
      return old
        ? {
            ...latest,
            messages: mergeMessages(synchronized),
            unreadIds: remainingUnread(
              [
                ...old.unreadIds.filter((id) => !latestIds.has(id)),
                ...latest.unreadIds,
              ],
              synchronized,
              userId,
            ),
            nextPage: old.nextPage,
            olderCursor: old.olderCursor,
            window: old.window,
          }
        : latest;
    },
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
  });

  const loadOlder = useCallback(async () => {
    const historyKey = chatKeys.history(identity, chatId);
    const current = cache.getQueryData<History>(historyKey);
    const page = current?.nextPage;
    const beforeId = current?.window?.beforeId ?? current?.olderCursor;
    if ((!page && !beforeId) || request.current || history.isFetching) return;
    const controller = new AbortController();
    request.current = controller;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const older = beforeId
        ? await getMessageWindow(chatId, { beforeId }, controller.signal)
        : await getHistory(chatId, controller.signal, page!);
      if (controller.signal.aborted) return;
      cache.setQueryData<History>(historyKey, (old) =>
        old
          ? {
              ...old,
              ...withPageUnread(
                old,
                mergeMessages(older.messages, old.messages),
                older.unreadIds,
                userId,
              ),
              nextPage: "nextPage" in older ? older.nextPage : null,
              olderCursor:
                !old.window && "beforeId" in older
                  ? older.beforeId
                  : old.olderCursor,
              window:
                old.window && "beforeId" in older
                  ? { ...old.window, beforeId: older.beforeId }
                  : old.window,
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
  }, [cache, chatId, identity, history.isFetching, userId]);

  async function openMessage(messageId: number) {
    const historyKey = chatKeys.history(identity, chatId);
    request.current?.abort();
    request.current = null;
    setLoadingOlder(false);
    setLoadingNewer(false);
    setNavigationError(null);
    setNavigating(false);
    if (
      cache
        .getQueryData<History>(historyKey)
        ?.messages.some((m) => m.id === messageId)
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setNavigating(true);
    try {
      await cache.cancelQueries({ queryKey: historyKey });
      const context = await getMessageWindow(
        chatId,
        { aroundId: messageId },
        controller.signal,
      );
      if (controller.signal.aborted)
        throw new DOMException("Aborted", "AbortError");
      cache.setQueryData<History>(historyKey, (old) =>
        old
          ? {
              ...old,
              messages: preserveReactions(context.messages, old.messages),
              unreadIds: remainingUnread(
                context.unreadIds ?? [],
                context.messages,
                userId,
              ),
              nextPage: null,
              window: {
                beforeId: context.beforeId,
                afterId: context.afterId,
                focusId: messageId,
              },
            }
          : old,
      );
      setOlderError(null);
    } catch (error) {
      if (!controller.signal.aborted) setNavigationError(error);
      throw error;
    } finally {
      if (request.current === controller) {
        request.current = null;
        setNavigating(false);
      }
    }
  }

  async function loadNewer() {
    const historyKey = chatKeys.history(identity, chatId);
    const afterId = cache.getQueryData<History>(historyKey)?.window?.afterId;
    if (!afterId || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoadingNewer(true);
    setNavigationError(null);
    try {
      const context = await getMessageWindow(
        chatId,
        { afterId },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      cache.setQueryData<History>(historyKey, (old) =>
        old?.window
          ? {
              ...old,
              ...withPageUnread(
                old,
                mergeMessages(old.messages, context.messages),
                context.unreadIds,
                userId,
              ),
              window: { ...old.window, afterId: context.afterId },
            }
          : old,
      );
    } catch (error) {
      if (!controller.signal.aborted) setNavigationError(error);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoadingNewer(false);
      }
    }
  }

  async function returnToLatest() {
    const historyKey = chatKeys.history(identity, chatId);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setNavigating(true);
    setLoadingOlder(false);
    setLoadingNewer(false);
    setNavigationError(null);
    try {
      await cache.cancelQueries({ queryKey: historyKey });
      const latest = await getHistory(chatId, controller.signal);
      if (!controller.signal.aborted) {
        cache.setQueryData<History>(historyKey, (old) => ({
          ...latest,
          messages: preserveReactions(latest.messages, old?.messages),
        }));
        setOlderError(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) setNavigationError(error);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setNavigating(false);
      }
    }
  }
  return {
    ...history,
    opening: history.isFetching && !history.isFetchedAfterMount,
    loadOlder,
    loadingOlder,
    olderError,
    openMessage,
    loadNewer,
    loadingNewer,
    returnToLatest,
    navigating,
    navigationError,
  };
}
