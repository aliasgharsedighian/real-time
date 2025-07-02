import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface MessagePayload {
  content: string;
  chatId: number;
}

export const useSendMessage = (token: string | null) =>
  useMutation({
    mutationFn: (data: MessagePayload) =>
      api.post("realtime/polling", data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
  });
