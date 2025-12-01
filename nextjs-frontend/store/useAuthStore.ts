import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UserProfile {
  id: number;
  firstname: string;
  lastname: string;
  address: string;
}

export interface User {
  id: number;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  profile: UserProfile;
}

interface AuthState {
  token: string | null | any;
  user: User | null;
  isLoggedIn: boolean;

  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  login: (data: { token: string; user: User }) => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoggedIn: false,

      setToken: (token) =>
        set((state) => ({
          token,
          isLoggedIn: !!token && !!state.user,
        })),

      setUser: (user) =>
        set((state) => ({
          user,
          isLoggedIn: !!state.token && !!user,
        })),

      login: ({ token, user }) =>
        set(() => ({
          token,
          user,
          isLoggedIn: true,
        })),

      logout: () =>
        set(() => ({
          token: null,
          user: null,
          isLoggedIn: false,
        })),

      updateProfile: (data) =>
        set((state) => {
          if (!state.user) return {};
          return {
            user: { ...state.user, ...data },
          };
        }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage), // IMPORTANT for Next.js
    }
  )
);
