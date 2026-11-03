import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface SessionState {
  tokens: Tokens | null;
  setTokens: (tokens: Tokens) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      tokens: null,
      setTokens: (tokens) => set({ tokens }),
      clear: () => set({ tokens: null }),
    }),
    {
      name: "beam-session-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tokens: state.tokens }),
    },
  ),
);
