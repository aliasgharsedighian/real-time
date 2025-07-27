import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useChatStore } from "../store/useChatStore";

interface MessagePayload {
  content: string;
  chatId: number;
}

export const useSendMessage = (token: string | null) => {
  const setChatError = useChatStore((state) => state.setChatError);

  return useMutation({
    mutationFn: (data: MessagePayload) =>
      api.post("realtime/polling", data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),

    onError: (error) => {
      setChatError(error?.message || "خطایی رخ داده است");
      toast.error("Message send failed");
      console.log("Message send failed:", error);
    },
  });
};
