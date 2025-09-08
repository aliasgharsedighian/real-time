import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  profile: UserProfile;
  // Add more fields if needed
}

export interface UserProfile {
  id: number;
  firstname: string;
  lastname: string;
  address: string;
}

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoggedIn: false,

      setToken: (token) => {
        set((state) => ({
          token,
          isLoggedIn: !!token && !!state.user,
        }));
      },

      setUser: (user) => {
        set((state) => ({
          user,
          isLoggedIn: !!state.token && !!user,
        }));
      },

      login: (token, user) => {
        set({
          token,
          user,
          isLoggedIn: true,
        });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isLoggedIn: false,
        });
      },
      updateProfile: (data) => {
        const currentUser = get().user;
        if (!currentUser) return;

        const updatedUser = {
          ...currentUser,
          ...data,
        };

        set({ user: updatedUser });
      },
    }),

    {
      name: "auth", // localStorage key
    }
  )
);
