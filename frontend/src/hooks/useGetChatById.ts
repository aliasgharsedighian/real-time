import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";

export function useGetChatById(params: string | undefined) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ["chatById"],
    queryFn: async () => {
      const res = await api.get(`realtime/polling/${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.data;
    },
  });
}
