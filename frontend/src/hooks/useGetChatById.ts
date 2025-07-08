import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { deepEqual } from "../utils/deepEquel";

export function useGetChatById(params: string | undefined) {
  const token = useAuthStore((state) => state.token);
  const setMessages = useChatStore((state) => state.setMessages);
  const messegaes = useChatStore((state) => state.messages);

  return useQuery({
    queryKey: ["chatById"],
    queryFn: async () => {
      const res = await api.get(`realtime/polling/${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const prevMsg = messegaes;
      const newPoll = res.data.data.chats;

      const areEqual = deepEqual(prevMsg, newPoll);

      if (!areEqual) {
        if (res.data?.data) {
          setMessages(res.data.data.chats);
        }
      }
      return res.data.data;
    },
    refetchInterval: 3000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
