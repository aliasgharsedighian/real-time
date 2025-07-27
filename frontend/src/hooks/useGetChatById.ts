import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { api } from "../lib/api";

const PAGE_SIZE = 20;

export function useGetChatById(chatId: string | undefined) {
  const token = useAuthStore((state) => state.token);
  const setMessages = useChatStore((state) => state.setMessages);
  const prevMessage = useChatStore((state) => state.messages);

  return useInfiniteQuery({
    queryKey: ["chatById"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get(
        `realtime/polling/${chatId}?page=${pageParam}&limit=${PAGE_SIZE}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const newMessages = res.data.data.chats;
      const users = res.data.data.users;

      setMessages([...newMessages, ...prevMessage]);

      return {
        users,
        chats: newMessages,
        nextPage: newMessages.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 1, // REQUIRED in v5
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
}

export const usePollUnreadMessages = (chatId: string | undefined) => {
  const token = useAuthStore((state) => state.token);
  const addMessage = useChatStore((state) => state.addMessage);

  return useQuery({
    queryKey: ["unread-messages", chatId],
    queryFn: async () => {
      const res = await api.get(`realtime/polling/unread/${chatId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const newMessages = res.data.data ?? [];
      newMessages.forEach((msg: any) => addMessage(msg));

      return newMessages;
    },
    enabled: !!chatId && !!token,
    refetchInterval: 3000, // Poll every 3s
    retry: true,
    retryDelay: (attempt) => Math.min(30000, 1000 * 2 ** attempt), // Exponential backoff
  });
};
