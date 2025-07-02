import { create } from "zustand";
import type { Message } from "../pages/polling/components/chatWidget";

interface ChatStore {
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;

  input: string;
  setInput: (text: string) => void;

  messages: Message[];
  setMessages: (messages: Message[]) => void;

  addMessage: (message: Message) => void;
  clearMessages: () => void;

  chatError: string | null;
  setChatError: (error: string | null) => void;

  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  unreadCount: 0,
  isChatOpen: false,
  setChatOpen: (open) =>
    set((state) => ({
      isChatOpen: open,
      unreadCount: open ? 0 : state.unreadCount,
    })),

  input: "",
  setInput: (text) => set({ input: text }),

  messages: [
    {
      id: 1,
      text: "سلام! چطور می‌تونم کمکت کنم؟",
      role: "admin",
      timestamp: Date.now().toString(),
    },
  ],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) =>
    set((state) => {
      const newState: Partial<ChatStore> = {
        messages: [...state.messages, msg],
      };
      if (!state.isChatOpen) {
        newState.unreadCount = state.unreadCount + 1;
      }
      return newState;
    }),
  clearMessages: () => set({ messages: [] }),

  chatError: null,
  setChatError: (error) => set({ chatError: error }),

  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
  toggleChat: () =>
    set((state) => {
      const isNowOpen = !state.isChatOpen;
      return {
        isChatOpen: isNowOpen,
        unreadCount: isNowOpen ? 0 : state.unreadCount,
      };
    }),
}));
