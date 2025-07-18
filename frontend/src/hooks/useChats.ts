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
  });
}
