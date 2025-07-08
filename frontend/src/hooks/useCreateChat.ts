import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface RequestPayload {
  firstMessage: string;
  participant: number[];
}

export const useCreateChat = (token: string | null) =>
  useMutation({
    mutationFn: (data: RequestPayload) =>
      api.post("realtime/polling/create-chat", data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
  });
