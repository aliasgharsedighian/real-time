import { useParams } from "react-router-dom";
import { useAuthStore } from "../../../store/useAuthStore";
import ChatsContainer from "./components/ChatsContainer";
import ChatInputArea from "./components/ChatInputArea";
import ChatHeader from "./components/ChatHeader";
import { useGetChatById } from "../../../hooks/useGetChatById";
import { useSendMessage } from "../../../hooks/useSendMessage";
import { useChatStore } from "../../../store/useChatStore";

export const PollingChatId = () => {
  const { chatId } = useParams();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const addMessage = useChatStore((state) => state.addMessage);
  const input = useChatStore((state) => state.input);
  const setInput = useChatStore((state) => state.setInput);
  const setChatError = useChatStore((state) => state.setChatError);

  const {
    data: chats,
    isLoading,
    isError,
    error: fetchMessagesError,
  } = useGetChatById(chatId);

  const { mutate: sendMessageToApi, isPending, error } = useSendMessage(token);

  const sendMessage = () => {
    if (!input.trim()) return;

    addMessage({
      id: crypto.randomUUID(),
      text: input,
      role: "user",
      timestamp: Date.now().toString(),
    });
    setInput("");
    sendMessageToApi(
      { content: input, chatId: chatId ? +chatId : 0 },
      {
        onSuccess: (response) => {
          const newMessage = response.data;
          console.log(newMessage);
          // setMessages([...messages, newMessage]);
          if (newMessage) {
            addMessage({
              id: crypto.randomUUID(),
              text: "خیلی راحت! فقط ایمیل و رمز عبورتو وارد کن.",
              role: "admin",
              timestamp: Date.now().toString(),
            });
          }
          setChatError(null);
        },
        onError: () => {
          addMessage({
            id: crypto.randomUUID(),
            text: error?.message || "مشکل در برقراری ارتباط!",
            role: "admin",
            timestamp: Date.now().toString(),
          });
          setChatError(error?.message || "خطایی رخ داده است");
          console.log("Message send failed:", error);
        },
      }
    );
  };

  return (
    <div>
      {/* Chat Box */}

      <div className="w-screen h-[94dvh] bg-white flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <ChatHeader />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <ChatsContainer
            chats={chats}
            user={user}
            isLoading={isLoading}
            isError={isError}
            error={fetchMessagesError}
          />
        </div>

        {/* Input Area */}
        <ChatInputArea sendMessage={sendMessage} isPending={isPending} />
      </div>
    </div>
  );
};
