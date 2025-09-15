// store/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./store"; // import your store's RootState

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
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
}

const initialState: AuthState = {
  token: null,
  user: null,
  isLoggedIn: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
      state.isLoggedIn = !!state.token && !!state.user;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isLoggedIn = !!state.token && !!state.user;
    },
    login: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isLoggedIn = true;
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isLoggedIn = false;
    },
    updateProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (!state.user) return;
      state.user = {
        ...state.user,
        ...action.payload,
      };
    },
  },
});

export const { setToken, setUser, login, logout, updateProfile } =
  authSlice.actions;

export default authSlice.reducer;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectToken = (state: RootState) => state.auth.token;
export const selectIsLoggedIn = (state: RootState) => state.auth.isLoggedIn;
