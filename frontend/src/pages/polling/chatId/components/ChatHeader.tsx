import PulseCircle from "../../../../components/ui/custom/PulseCircle";
import { useChatStore } from "../../../../store/useChatStore";

const ChatHeader = () => {
  const chatError = useChatStore((state) => state.chatError);

  return (
    <div
      style={{
        backgroundColor: "#2b7fff",
        color: "white",
        padding: "12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span>Chat Messenger</span>
        {chatError ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <PulseCircle size="7px" color="#d32f2f" />
            <span
              style={{ fontSize: 12, color: "#d32f2f", fontWeight: "bold" }}
            >
              Offline!
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <PulseCircle size="7px" color="white" />
            <span style={{ fontSize: 12 }}>Online!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
