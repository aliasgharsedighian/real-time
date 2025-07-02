import { useEffect, useRef } from "react";
import { useChatStore } from "../../../store/useChatStore";
import Spinner from "../../../components/ui/Spinner";

interface PageProps {
  isLoading: boolean;
  isError: boolean;
  error: any;
}

function ChatsContainer({ isLoading, isError, error }: PageProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((state) => state.messages);

  useEffect(() => {
    // Scroll to bottom on every message update
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function formatTimeAgo(isoDate: string): string {
    const now = new Date();
    const past = new Date(Number(isoDate));
    const diff = Math.floor((now.getTime() - past.getTime()) / 1000); // in seconds

    if (diff < 60) return "لحظاتی پیش";
    if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
    return `${Math.floor(diff / 86400)} روز پیش`;
  }

  if (isLoading)
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "16px",
          height: "90%",
        }}
      >
        <Spinner width={35} height={35} color="#2b7fff" />
      </div>
    );
  if (isError) {
    return (
      <p style={{ color: "red" }}>{error.message || "Something went wrong!"}</p>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        padding: "12px",
        overflowY: "auto",
      }}
    >
      {messages.map((msg) => {
        const isAdmin = msg.role === "admin";
        const timeAgo = formatTimeAgo(msg.timestamp);

        return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: !isAdmin ? "flex-end" : "flex-start",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: isAdmin ? "row" : "row-reverse",
                gap: "8px",
                alignItems: "flex-start",
                maxWidth: "85%",
              }}
            >
              {isAdmin ? (
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
                  alignItems: isAdmin ? "flex-start" : "flex-end",
                  gap: "2px",
                }}
              >
                <span style={{ fontSize: "11px" }}>{timeAgo}</span>
                <span
                  style={{
                    backgroundColor: isAdmin ? "#2b7fff" : "#f1f1f1",
                    color: isAdmin ? "white" : "#333",
                    padding: "10px 14px",
                    borderTopLeftRadius: isAdmin ? "12px" : "0px",
                    borderTopRightRadius: isAdmin ? "0px" : "12px",
                    borderBottomRightRadius: "10px",
                    borderBottomLeftRadius: "10px",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                    position: "relative",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  {msg.text}
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
