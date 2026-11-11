import { create } from "zustand";

// User types
export interface UserProfile {
  id: number;
  firstname: string;
  lastname: string;
  address: string | null;
  userId: number;
}

export interface User {
  id: number;
  email: string | null;
  profile: UserProfile;
}

export interface ChatUser {
  id: number;
  userId: number;
  chatId: number;
  user: User;
}

interface ChatState {
  currentChatId: number | null;
  currentOpenUserDetail: ChatUser[];
  typingUsers: ChatUser[];

  setCurrentChatId: (chatId: number | null) => void;
  setCurrentOpenUserDetail: (users: ChatUser[]) => void;
  clearCurrentOpenUserDetail: () => void;

  setTypingUsers: (users: ChatUser[]) => void;
  addTypingUser: (user: ChatUser) => void;
  removeTypingUser: (userId: number) => void;
  clearTypingUsers: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  currentChatId: null,
  currentOpenUserDetail: [],
  typingUsers: [],

  setCurrentChatId: (chatId) => set({ currentChatId: chatId }),

  setCurrentOpenUserDetail: (users) => set({ currentOpenUserDetail: users }),
  clearCurrentOpenUserDetail: () => set({ currentOpenUserDetail: [] }),

  setTypingUsers: (users) => set({ typingUsers: users }),
  addTypingUser: (user) =>
    set((state) => {
      if (state.typingUsers.some((u) => u.userId === user.userId)) return state;
      return { typingUsers: [...state.typingUsers, user] };
    }),
  removeTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
    })),
  clearTypingUsers: () => set({ typingUsers: [] }),
}));
