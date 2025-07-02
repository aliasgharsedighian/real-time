import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface MessagePayload {
  content: string;
}

export const useSendMessage = () =>
  useMutation({
    mutationFn: (data: MessagePayload) => api.post("/posts", data),
  });
