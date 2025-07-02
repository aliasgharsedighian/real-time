import { Link } from "react-router-dom";
import { useAllChats } from "../../hooks/useChats";
import ChatHeader from "./components/ChatHeader";
import { useAuthStore } from "../../store/useAuthStore";

export const Polling = () => {
  const user = useAuthStore((state) => state.user);
  const {
    data: chats,
    isLoading,
    isError,
    error: fetchMessagesError,
  } = useAllChats();

  return (
    <div>
      {/* Chat Box */}

      <div className="w-screen h-[94dvh] bg-white flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <ChatHeader />

        {/* Chats */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex-1 overflow-y-auto">
            {chats?.data?.map((chat: any) => (
              <Link key={chat.id} to={`/polling/${chat.id}`}>
                <div className="border-b py-3">
                  {chat?.messages?.map((message: any) => (
                    <div
                      key={message.id}
                      className="px-2 flex justify-between w-full"
                    >
                      <p>{message.content}</p>
                      <span>{message.createdAt}</span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
