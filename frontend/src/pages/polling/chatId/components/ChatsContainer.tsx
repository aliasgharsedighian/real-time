import { useEffect, useRef } from "react";
import { useChatStore } from "../../../../store/useChatStore";
import type { UserProfile } from "../../../../store/useAuthStore";

interface PageProps {
  chats: any;
  isLoading: boolean;
  isError: boolean;
  error: any;
  user: any;
}

function ChatsContainer({ chats, user, isLoading, isError, error }: PageProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((state) => state.messages);

  useEffect(() => {
    // Scroll to bottom on every message update
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) return <div>loading...</div>;
  if (isError) {
    return (
      <p style={{ color: "red" }}>{error.message || "Something went wrong!"}</p>
    );
  }

  return (
    <div
      className="flex flex-col-reverse"
      style={{
        flex: 1,
        padding: "12px",
        overflowY: "auto",
      }}
    >
      {chats?.data?.reverse().map((msg: any) => {
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
                <span style={{ fontSize: "11px" }}>{msg.createdAt}</span>
                <span
                  style={{
                    backgroundColor: currentUser ? "#2b7fff" : "#f1f1f1",
                    color: currentUser ? "white" : "#333",
                    padding: "10px 14px",
                    borderTopLeftRadius: currentUser ? "12px" : "0px",
                    borderTopRightRadius: currentUser ? "0px" : "12px",
                    borderBottomRightRadius: "10px",
                    borderBottomLeftRadius: "10px",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                    position: "relative",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  {msg.content}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

export default ChatsContainer;
