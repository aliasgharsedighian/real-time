// src/components/chat/ChatToggleButton.tsx

import { motion } from "framer-motion";
import { useIsMobile } from "../../../hooks/use-mobile";
import { useChatStore } from "../../../store/useChatStore";
import Button from "../../../components/ui/Button";

const ChatToggleButton = () => {
  const isMobile = useIsMobile();

  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const toggleChat = useChatStore((state) => state.toggleChat);
  const unreadCount = useChatStore((state) => state.unreadCount);

  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 5 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleChat}
      style={{
        background: "#2b7fff",
        color: "white",
        borderRadius: "50%",
        width: "50px",
        height: "50px",
        cursor: "pointer",
        border: "none",
        display: isMobile ? (isChatOpen ? "none" : "flex") : "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s ease",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
      }}
    >
      <Button
        type="button"
        style={{
          position: "relative",
          borderRadius: "100%",
          width: "50px",
          height: "50px",
        }}
      >
        {isChatOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            style={{ width: "28px", height: "28px", color: "white" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            style={{ width: "24px", height: "24px" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
            />
          </svg>
        )}

        {/* Notification badge */}
        {!isChatOpen && unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              bottom: "-4px",
              left: "-4px",
              backgroundColor: "red",
              color: "white",
              borderRadius: "100%",
              fontSize: "11px",
              width: "20px",
              height: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontFamily: "IRANSans, sans-serif",
            }}
          >
            {unreadCount}
          </span>
        )}
      </Button>
    </motion.div>
  );
};

export default ChatToggleButton;
