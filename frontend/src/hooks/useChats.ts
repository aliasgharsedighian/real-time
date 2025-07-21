import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";

export function useAllChats() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ["Allchats"],
    queryFn: async () => {
      const res = await api.get(`realtime/polling`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.data;
    },
    refetchInterval: 3000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
