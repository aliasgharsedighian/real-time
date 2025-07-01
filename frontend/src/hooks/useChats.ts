import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useAllChats() {
  const token = localStorage.getItem("token");
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
