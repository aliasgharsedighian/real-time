import { useEffect, useRef } from "react";
import { useChatStore } from "../../../../store/useChatStore";
import { formatDateBasedOnToday } from "../../../../utils/dateUtils";
import ChatContainerLoading from "./ChatContainerLoading";
import InfiniteScroll from "react-infinite-scroll-component";

interface PageProps {
  isLoading: boolean;
  isError: boolean;
  error: any;
  user: any;
  fetchNextPage: any;
  hasNextPage: any;
  hasMoreMessage: any;
}

function ChatsContainer({
  user,
  isLoading,
  fetchNextPage,
  hasNextPage,
  hasMoreMessage,
}: PageProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((state) => state.messages);

  useEffect(() => {
    console.log(messages);
  }, [messages]);

  const isAtBottom = () => {
    const el = document.getElementById("scrollableDiv");
    //@ts-ignore
    return el.scrollHeight - el.scrollTop === el.clientHeight;
  };

  useEffect(() => {
    // Scroll to bottom on every message update

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  if (isLoading || messages.length === 0) return <ChatContainerLoading />;

  if (messages.length !== 0) {
    return (
      <div
        id="scrollableDiv"
        className="flex flex-col"
        style={{
          flex: 1,
          padding: "12px",
          overflowY: "auto",
        }}
      >
        <InfiniteScroll
          dataLength={messages.length}
          next={() => {
            console.log("test");
            fetchNextPage();
          }}
          hasMore={true}
          inverse={true}
          scrollableTarget="scrollableDiv"
          loader={<span>Loading...</span>}
        >
          {messages.reverse().map((msg: any) => {
            const currentUser = msg.senderId === user.id;

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: !currentUser ? "flex-end" : "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div
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
                        src={
                          import.meta.env.MODE === "development"
                            ? "/assets/people-user-team.png"
                            : `${
                                import.meta.env.VITE_SERVER_ADDRESS
                              }/assets/people-user-team.png`
                        }
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
                        src={
                          import.meta.env.MODE === "development"
                            ? "/assets/user-icon.png"
                            : `${
                                import.meta.env.VITE_SERVER_ADDRESS
                              }/assets/user-icon.png`
                        }
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
        </InfiniteScroll>

        <div ref={bottomRef} />
      </div>
    );
  }
}

export default ChatsContainer;
