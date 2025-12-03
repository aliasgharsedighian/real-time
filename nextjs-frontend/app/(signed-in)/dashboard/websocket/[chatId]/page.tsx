"use client";

import { notFound, useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { formatDateBasedOnToday } from "@/components/utils/dateUtils";
import { Button } from "@/components/ui/button";
import { SendIcon } from "lucide-react";
import ChatSkeleton from "../components/ChatLoading";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";

const PAGE_SIZE = 100;

// fetch initial messages with token
async function fetchInitialMessages(chatId: number, token: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_ADDRESS}api/v1/realtime/polling/${chatId}?page=1&limit=${PAGE_SIZE}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (data.statusCode === 404) {
    notFound();
  }

  return data.data ?? {};
}

export default function ChatRoomPage() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const params = useParams<{ chatId: string }>();
  const chatId = Number(params.chatId);
  const user = useAuthStore((state) => state.user);
  const setCurrentChatId = useChatStore((s) => s.setCurrentChatId);
  const setCurrentOpenUserDetail = useChatStore(
    (s) => s.setCurrentOpenUserDetail
  );
  const typingUsers = useChatStore((s) => s.typingUsers);

  const [input, setInput] = useState("");
  // const [typingUsers, setTypingUsers] = useState<string[]>([]); // track users typing

  const queryClient = useQueryClient();
  const socket = getSocket();
  let typingTimeout: NodeJS.Timeout;

  // Replace this with your actual token (e.g., from session)
  const token = useAuthStore((state) => state.token);

  // Load initial messages
  const {
    data: messages = [],
    isLoading,
    isSuccess,
    isError,
  } = useQuery({
    queryKey: ["chat", chatId, "messages"],
    queryFn: () => fetchInitialMessages(chatId, token),
    enabled: !!token && !!chatId, // only run if token and chatId exist
  });

  // Setup socket
  useEffect(() => {
    if (!token || !chatId || !user) return;

    // Zustand actions
    const addTypingUser = useChatStore.getState().addTypingUser;
    const removeTypingUser = useChatStore.getState().removeTypingUser;

    const bottom = bottomRef.current;

    // --- Handle typing:start ---
    const handleTypingStart = (payload: {
      chatId: number;
      userId: number;
      username: string;
    }) => {
      if (
        payload.chatId === chatId &&
        payload.username !== user?.profile.firstname
      ) {
        // Add user to typingUsers in store
        addTypingUser({
          id: payload.userId,
          userId: payload.userId,
          chatId: payload.chatId,
          user: {
            id: payload.userId,
            email: null,
            profile: {
              id: payload.userId,
              firstname: payload.username || user.email || "",
              lastname: "",
              address: null,
              userId: payload.userId,
            },
          },
        });
      }
    };

    // --- Handle typing:stop ---
    const handleTypingStop = (payload: {
      chatId: number;
      userId: number;
      username: string;
    }) => {
      if (
        payload.chatId === chatId &&
        payload.username !== user?.profile.firstname
      ) {
        removeTypingUser(payload.userId);
      }
    };

    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    // --- Join chat room ---
    socket.emit("chat:join", { chatId, userId: user.id });

    // --- Handle new messages ---
    const handleNewMessage = (msg: any) => {
      if (msg.chatId !== chatId) return;

      queryClient.setQueryData(["chat", chatId, "messages"], (old: any) => {
        const messages = old?.chats ?? [];
        return { ...old, chats: [...messages, msg] };
      });

      markAllRead();
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.emit("chat:leave", { chatId, userId: user.id });
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("message:new", handleNewMessage);
    };
  }, [chatId, token, user?.id, queryClient]);

  useEffect(() => {
    if (isSuccess) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      setCurrentOpenUserDetail(messages.users);
    }
  }, [isSuccess]);

  useEffect(() => {
    setCurrentChatId(Number(params.chatId));
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    const socket = getSocket();
    socket.emit("message:send", {
      chatId,
      senderId: user?.id,
      content: input,
    });
    setInput("");
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 1000);
  };

  const markAllRead = () => {
    socket.emit("message:read", {
      chatId,
      userId: user?.id,
      messageIds: messages.map((m: any) => m.id),
    });
    setTimeout(() => {
      bottomRef?.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // prevent newline
      if (input.trim()) {
        sendMessage();
      }
    }
  };

  const handleSetTypingChange = (e: any) => {
    setInput(e.target.value);

    // Notify typing:start
    socket.emit("typing:start", {
      chatId,
      userId: user?.id,
      username: user?.profile.firstname,
    });

    // Clear old timeout and set new one
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing:stop", {
        chatId,
        userId: user?.id,
        username: user?.profile.firstname,
      });
    }, 4500); // stops typing after 1.5s of inactivity
  };

  if (isLoading)
    return (
      <div className="w-full h-[calc(100dvh-64px)] bg-white flex flex-col justify-between overflow-hidden">
        <ChatSkeleton />
      </div>
    );
  if (isError)
    return (
      <div className="w-full h-[calc(100dvh-64px)] bg-white flex flex-col justify-between overflow-hidden">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">
          Error Loading Message
        </h2>
        <p className="text-muted-foreground">Please try again later</p>
      </div>
    );

  return (
    <div className="w-full h-[calc(100dvh-64px)] bg-white flex flex-col justify-between overflow-hidden">
      <div
        ref={chatContainerRef}
        className="relative flex flex-col flex-1 p-0 pt-2 overflow-y-auto"
      >
        {typingUsers.length > 0 && (
          <div className="bg-white absolute top-0 w-full z-10">
            <p className="text-center text-sm text-gray-500">
              {typingUsers.length === 1
                ? `${
                    typingUsers[0].user.profile.firstname
                      ? typingUsers[0].user.profile.firstname
                      : typingUsers[0].user.email
                  } is typing...`
                : `${typingUsers.length} people are typing...`}
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {messages.chats
            ? messages?.chats.map((msg: any, index: number) => {
                const currentUser = msg.senderId === user?.id;

                return (
                  <div
                    key={index}
                    className={`px-2 flex mb-3 relative ${
                      !currentUser ? "justify-end" : "justify-start"
                    } ${
                      index === messages.chats.length - messages.unreadCount
                        ? "border-t"
                        : ""
                    }`}
                  >
                    {index === messages.chats.length - messages.unreadCount && (
                      <span className="absolute text-sm flex items-center justify-center w-[96%]">
                        unread messages
                      </span>
                    )}
                    <div
                      className={`flex gap-2 items-start max-w-[85%] ${
                        currentUser ? "flex-row" : "flex-row-reverse"
                      } ${
                        index === messages.chats.length - messages.unreadCount
                          ? "mt-7"
                          : ""
                      }`}
                    >
                      {currentUser ? (
                        <div
                          style={{
                            background: "#efefef",
                            borderRadius: "100%",
                            width: "35px",
                            height: "35px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flex: "none",
                          }}
                        >
                          <img
                            style={{ width: "28px", height: "28px" }}
                            src="/assets/icons/people-user-team.png"
                            alt=""
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            background: "#efefef",
                            borderRadius: "100%",
                            width: "35px",
                            height: "35px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flex: "none",
                          }}
                        >
                          <img
                            style={{ width: "28px", height: "28px" }}
                            src="/assets/icons/user-icon.png"
                            alt=""
                          />
                        </div>
                      )}
                      <div
                        className={`flex flex-col gap-0.5 ${
                          currentUser ? "items-start" : "items-end"
                        }`}
                      >
                        <span className="text-[11px]">
                          {formatDateBasedOnToday(msg.createdAt)}
                        </span>
                        <div
                          className={`flex items-end relative py-2.5 px-3 rounded-br-[10px] rounded-bl-[10px] break-words whitespace-pre-wrap relative text-sm leading-[1.4] ${
                            currentUser
                              ? "bg-[#2b7fff] text-white rounded-tr-[12px]"
                              : "bg-[#f1f1f1] text-[#333] rounded-tl-[12px]"
                          }`}
                        >
                          <span className="pr-2">{msg.content}</span>
                          {currentUser ? (
                            msg.readStatuses ? (
                              msg?.readStatuses?.length === 0 ? (
                                <div className="absolute right-1 bottom-2">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="size-3"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="m4.5 12.75 6 6 9-13.5"
                                    />
                                  </svg>
                                </div>
                              ) : (
                                <div className="absolute right-1 bottom-2">
                                  <div className="relative flex items-center">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth={1.5}
                                      stroke="currentColor"
                                      className="size-3 absolute right-0"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m4.5 12.75 6 6 9-13.5"
                                      />
                                    </svg>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth={1.5}
                                      stroke="currentColor"
                                      className="size-3 absolute right-1"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m4.5 12.75 6 6 9-13.5"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="absolute right-1 bottom-2">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                  className="size-3"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m4.5 12.75 6 6 9-13.5"
                                  />
                                </svg>
                              </div>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            : null}

          <div ref={bottomRef} />
        </div>

        {/* <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
        />
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>

      <button className="text-sm underline" onClick={markAllRead}>
        Mark all as read
      </button> */}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderTop: "1px solid #eee",
        }}
      >
        <textarea
          style={{
            border: "none",
            resize: "none",
            boxShadow: "none",
            padding: "8px",
            outline: "none",
            width: "100%",
            fontFamily: "IRANSans, sans-serif",
          }}
          value={input}
          onChange={(e) => handleSetTypingChange(e)}
          onKeyDown={handleKeyDown}
          placeholder="Write your message ..."
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #eee",
            padding: "4px 8px",
          }}
        >
          <Button variant="ghost">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              style={{
                width: "20px",
                height: "20px",
                transform: "rotate(-45deg)",
                color: "#aaa",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
              />
            </svg>
          </Button>
          <Button
            type="submit"
            variant="default"
            onClick={sendMessage}
            disabled={!input}
          >
            <SendIcon />
          </Button>
        </div>
      </div>{" "}
    </div>
  );
}
