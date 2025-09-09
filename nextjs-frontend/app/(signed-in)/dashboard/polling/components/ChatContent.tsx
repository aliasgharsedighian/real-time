"use client";

import { Button } from "@/components/ui/button";
import { formatDateBasedOnToday } from "@/components/utils/dateUtils";
import { useGetChatById, usePollUnreadMessages } from "@/hooks/useGetChatById";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import { useEffect, useRef } from "react";

function ChatsContainer({
  chatId,
  token,
}: {
  chatId: string;
  token: string | undefined;
}) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollWhenGetOlderMessage = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const messages = useChatStore((state) => state.messages);

  const onScroll = () => {
    if (!chatContainerRef.current) return;
    if (
      chatContainerRef.current.scrollTop === 0 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
      scrollWhenGetOlderMessage.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    // Scroll to bottom on every message update

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }, 100);
  }, []);

  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: fetchMessagesError,
  } = useGetChatById(chatId);

  usePollUnreadMessages(chatId);

  //   useEffect(() => {
  //     console.log(messages);
  //   }, [messages]);

  if (messages.length !== 0) {
    return (
      <div
        ref={chatContainerRef}
        onScroll={onScroll}
        className="flex flex-col"
        style={{
          flex: 1,
          padding: "12px",
          overflowY: "auto",
        }}
      >
        {hasNextPage ? (
          <Button
            variant="secondary"
            onClick={() => {
              fetchNextPage();
              scrollWhenGetOlderMessage.current?.scrollIntoView({
                behavior: "smooth",
              });
            }}
          >
            Load older message
          </Button>
        ) : null}
        {messages.reverse().map((msg: any, index: number) => {
          const currentUser = msg.senderId === user?.id;

          return (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent: !currentUser ? "flex-end" : "flex-start",
                marginBottom: "12px",
              }}
            >
              <div
                ref={index === 19 ? scrollWhenGetOlderMessage : null}
                className={`${index === 19 ? "text-red-600" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: currentUser ? "row" : "row-reverse",
                  gap: "8px",
                  alignItems: "flex-start",
                  maxWidth: "85%",
                }}
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
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: currentUser ? "flex-start" : "flex-end",
                    gap: "2px",
                  }}
                >
                  <span style={{ fontSize: "11px" }}>
                    {formatDateBasedOnToday(msg.createdAt)}
                  </span>
                  <div
                    className="flex items-end relative"
                    style={{
                      backgroundColor: currentUser ? "#2b7fff" : "#f1f1f1",
                      color: currentUser ? "white" : "#333",
                      padding: "10px 14px",
                      borderTopLeftRadius: currentUser ? "0px" : "12px",
                      borderTopRightRadius: currentUser ? "12px" : "0px",
                      borderBottomRightRadius: "10px",
                      borderBottomLeftRadius: "10px",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      position: "relative",
                      fontSize: "14px",
                      lineHeight: "1.4",
                    }}
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
                            className="size-6"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
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
        })}
      </div>
    );
  }
}

export default ChatsContainer;
