import { Link } from "react-router-dom";
import { useAllChats } from "../../hooks/useChats";
import ChatHeader from "./components/ChatHeader";
import { capitalizeFirstLetter } from "../../utils/stringUtils";
import { formatDateBasedOnToday } from "../../utils/dateUtils";
import ChatContainerLoading from "./chatId/components/ChatContainerLoading";

export const Polling = () => {
  const { data: chats, isLoading } = useAllChats();

  // const repeatedArray = Array.from(
  //   { length: 12 },
  //   (_, i) => chats?.data[i % chats?.data.length]
  // );

  return (
    <div className="flex flex-col relative overflow-hidden grow shrink basis-[0%] h-screen">
      {/* Chat Box */}

      {/* Header */}
      <ChatHeader />

      {/* Chats */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="flex-1 overflow-y-auto ">
          {isLoading ? (
            <div className="w-full h-[80vh]">
              <ChatContainerLoading />
            </div>
          ) : (
            chats?.data?.map((chat: any) => (
              <Link key={chat.id} to={`/polling/${chat.id}`}>
                <div className="border-b py-3 px-2">
                  <div className="w-full flex justify-between">
                    <span className="font-bold">
                      {chat.participants.length === 1 ? (
                        <>
                          {chat.participants[0].user.profile.firstname
                            ? capitalizeFirstLetter(
                                chat.participants[0].user.profile.firstname
                              ) +
                              " " +
                              capitalizeFirstLetter(
                                chat.participants[0].user.profile.lastname
                              )
                            : chat.participants[0].user.email}
                        </>
                      ) : (
                        "Group"
                      )}
                    </span>
                    {chat?._count.messages ? (
                      <div className="bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-sm">
                        {chat?._count.messages}
                      </div>
                    ) : null}
                  </div>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
