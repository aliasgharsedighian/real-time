import { Link } from "react-router-dom";
import { useAllChats } from "../../hooks/useChats";
import ChatHeader from "./components/ChatHeader";
import { capitalizeFirstLetter } from "../../utils/stringUtils";
import { formatDateBasedOnToday } from "../../utils/dateUtils";

export const Polling = () => {
  const { data: chats } = useAllChats();

  return (
    <div>
      {/* Chat Box */}

      <div className="w-screen h-[100dvh] bg-white flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <ChatHeader />

        {/* Chats */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex-1 overflow-y-auto">
            {chats?.data?.map((chat: any) => (
              <Link key={chat.id} to={`/polling/${chat.id}`}>
                <div className="border-b py-3 px-2">
                  <span className="font-bold">
                    {chat.participants.length === 1 ? (
                      <>
                        {capitalizeFirstLetter(
                          chat.participants[0].user.profile.firstname
                        ) +
                          " " +
                          capitalizeFirstLetter(
                            chat.participants[0].user.profile.lastname
                          )}
                      </>
                    ) : (
                      "Group"
                    )}
                  </span>
                  {chat?.messages?.map((message: any) => (
                    <div
                      key={message.id}
                      className="flex justify-between w-full"
                    >
                      <p className="line-clamp-1">{message.content}</p>
                      <span className="text-sm">
                        {formatDateBasedOnToday(message.createdAt)}
                      </span>
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
