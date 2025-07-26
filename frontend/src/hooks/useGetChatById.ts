import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { api } from "../lib/api";
import { deepEqual } from "../utils/deepEquel";

const PAGE_SIZE = 20;

export function useGetChatById(
  chatId: string | undefined,
  setHasMoreMessage: (value: boolean) => void
) {
  const token = useAuthStore((state) => state.token);
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const prevMessages = useChatStore((state) => state.messages);

  return useInfiniteQuery({
    queryKey: ["chatById", chatId],
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

      if (newMessages.length < PAGE_SIZE) {
        setHasMoreMessage(false);
      }

      // const areEqual = deepEqual(prevMessages, newMessages);
      // if (!areEqual) {
      setMessages([...newMessages]);
      // }

      return {
        users,
        chats: newMessages,
        nextPage: newMessages.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 1, // REQUIRED in v5
    getNextPageParam: (lastPage) => lastPage.nextPage,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchInterval: 3000,
    enabled: !!chatId,
  });
}
