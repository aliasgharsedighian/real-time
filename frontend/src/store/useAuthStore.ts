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
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => {
        set({ token });
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: "auth", // localStorage key
    }
  )
);
