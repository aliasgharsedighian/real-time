import { useLocation, useParams } from "react-router-dom";
import { useAuthStore } from "../../../store/useAuthStore";
import ChatsContainer from "./components/ChatsContainer";
import ChatInputArea from "./components/ChatInputArea";
import ChatHeader from "./components/ChatHeader";
import {
  useGetChatById,
  usePollUnreadMessages,
} from "../../../hooks/useGetChatById";
import { useSendMessage } from "../../../hooks/useSendMessage";
import { useChatStore } from "../../../store/useChatStore";
import { useEffect, useRef } from "react";

export const PollingChatId = () => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const { chatId } = useParams();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const input = useChatStore((state) => state.input);
  const setInput = useChatStore((state) => state.setInput);

  const setChatError = useChatStore((state) => state.setChatError);
  const addMessage = useChatStore((state) => state.addMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);

  useEffect(() => {
    return () => {
      clearMessages(); // ✅ Clear messages on unmount
    };
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      clearMessages();
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  useEffect(() => {
    return () => {
      clearMessages(); // cleanup when location changes away from chat page
    };
  }, [location.pathname]);

  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: fetchMessagesError,
  } = useGetChatById(chatId);

  usePollUnreadMessages(chatId);

  const { mutate: sendMessageToApi, isPending } = useSendMessage(token);

  const sendMessage = () => {
    if (!input.trim()) return;
    setInput("");
    sendMessageToApi(
      { content: input, chatId: chatId ? +chatId : 0 },
      {
        onSuccess: (response) => {
          const newMessage = response.data;

          // setMessages([...messages, newMessage]);
          if (newMessage) {
            addMessage(response.data.data);
            setTimeout(() => {
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
          setChatError(null);
        },
      }
    );
  };

  return (
    <div>
      {/* Chat Box */}

      <div className="w-screen h-[100dvh] bg-white flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <ChatHeader chatId={chatId} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <ChatsContainer
            user={user}
            isLoading={isLoading}
            isError={isError}
            error={fetchMessagesError}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            bottomRef={bottomRef}
          />
        </div>

        {/* Input Area */}
        <ChatInputArea sendMessage={sendMessage} isPending={isPending} />
      </div>
    </div>
  );
};
