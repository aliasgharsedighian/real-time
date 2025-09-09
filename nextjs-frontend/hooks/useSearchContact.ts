import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface SearchPayload {
  search: string;
}

export const useSearchContact = (token: string | null) =>
  useMutation({
    mutationFn: (data: SearchPayload) =>
      api.post("realtime/search-user", data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
  });
