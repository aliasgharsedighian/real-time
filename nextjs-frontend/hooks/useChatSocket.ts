"use client";

import { useEffect, useMemo } from "react";
import { getSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";

type Message = {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  createdAt: string;
  sender?: any;
};

export function useChatSocket(chatId: number, userId: number) {
  const queryClient = useQueryClient();
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    if (!chatId || !userId) return;
    socket.emit("chat:join", { chatId, userId });

    const onNew = (msg: Message) => {
      if (msg.chatId !== chatId) return;
      queryClient.setQueryData<Message[]>(
        ["chat", chatId, "messages"],
        (old = []) => [...old, msg]
      );
    };

    const onRead = (rs: {
      messageId: number;
      userId: number;
      readAt: string;
    }) => {
      // Optional: update message read state in cache
      // (depends on how you model client state)
    };

    socket.on("message:new", onNew);
    socket.on("message:read", onRead);

    return () => {
      socket.off("message:new", onNew);
      socket.off("message:read", onRead);
      // socket.emit('chat:leave', { chatId, userId }) // if you add it
    };
  }, [socket, chatId, userId, queryClient]);

  const sendMessage = (content: string) => {
    socket.emit("message:send", { chatId, senderId: userId, content });
  };

  const markRead = (messageIds: number[]) => {
    socket.emit("message:read", { chatId, userId, messageIds });
  };

  const startTyping = () => socket.emit("typing:start", { chatId, userId });
  const stopTyping = () => socket.emit("typing:stop", { chatId, userId });

  return { sendMessage, markRead, startTyping, stopTyping };
}
