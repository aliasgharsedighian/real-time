import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { useChatStore } from "../store/useChatStore";
import { useIsMobile } from "../hooks/use-mobile";
import { useAuthStore } from "../store/useAuthStore";
import { useAllChats } from "../hooks/useChats";
import { useSendMessage } from "../hooks/useSendMessage";
import ChatToggleButton from "../pages/polling/components/ChatToggleButton";
import ChatHeader from "../pages/polling/components/ChatHeader";
import ChatsContainer from "../pages/polling/components/ChatsContainer";
import ChatInputArea from "../pages/polling/components/ChatInputArea";

export const ChatMessanger = ({ currentShow }: { currentShow: string }) => {
  const { chatId } = useParams();

  const chatRef = useRef(null);
  const isMobile = useIsMobile();

  const isChatOpen = useChatStore((state) => state.isChatOpen);
  const setChatOpen = useChatStore((state) => state.setChatOpen);
  const addMessage = useChatStore((state) => state.addMessage);
  const setChatError = useChatStore((state) => state.setChatError);
  const input = useChatStore((state) => state.input);
  const setInput = useChatStore((state) => state.setInput);

  const token = useAuthStore((state) => state.token);
  const setToken = useAuthStore((state) => state.setToken);

  const handleLogin = () => {
    setToken("your_token_here");
    console.log(token);
  };

  useEffect(() => {
    handleLogin();
  }, []);

  const { data, isLoading, isError, error: fetchMessagesError } = useAllChats();

  useEffect(() => {
    if (data) {
      addMessage({
        id: 2,
        text: "سلام. می‌خواستم بدونم چطوری ثبت‌نام کنم؟",
        role: "user",
        timestamp: Date.now().toString(),
      });
    }
  }, [data]);

  const { mutate: sendMessageToApi, isPending, error } = useSendMessage();
  const sendMessage = () => {
    if (!input.trim()) return;

    addMessage({
      id: crypto.randomUUID(),
      text: input,
      role: "user",
      timestamp: Date.now().toString(),
    });
    setInput("");
    sendMessageToApi(
      { content: input },
      {
        onSuccess: (response) => {
          const newMessage = response.data;
          console.log(newMessage);
          // setMessages([...messages, newMessage]);
          if (newMessage) {
            addMessage({
              id: crypto.randomUUID(),
              text: "خیلی راحت! فقط ایمیل و رمز عبورتو وارد کن.",
              role: "admin",
              timestamp: Date.now().toString(),
            });
          }
          setChatError(null);
        },
        onError: () => {
          addMessage({
            id: crypto.randomUUID(),
            text: error?.message || "مشکل در برقراری ارتباط!",
            role: "admin",
            timestamp: Date.now().toString(),
          });
          setChatError(error?.message || "خطایی رخ داده است");
          console.log("Message send failed:", error);
        },
      }
    );
  };

  // Close on outside click or Esc key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      //@ts-ignore
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setChatOpen(false);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChatOpen(false);
      }
    };

    if (isChatOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isChatOpen]);

  return (
    <div
      ref={chatRef}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 999999,
        fontFamily: "IRANSans, sans-serif",
      }}
    >
      {/* Toggle Button */}
      <ChatToggleButton />

      {/* Chat Box */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: 50 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{
              position: "absolute",
              bottom: isMobile ? "-20px" : "60px",
              right: isMobile ? "-20px" : "0px",
              width: isMobile ? "100dvw" : "350px",
              height: isMobile ? "100dvh" : "500px",
              backgroundColor: "#ffffff",
              borderRadius: isMobile ? 0 : "8px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              justifyContent: "space-between",
            }}
          >
            {/* Header */}
            <ChatHeader />

            {/* Messages */}
            {currentShow === "usersChat" ? (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <ChatsContainer
                  isLoading={isLoading}
                  isError={isError}
                  error={fetchMessagesError}
                />
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto" }}></div>
            )}
            {/* Input Area */}
            {currentShow === "usersChat" ? (
              <ChatInputArea sendMessage={sendMessage} isPending={isPending} />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
