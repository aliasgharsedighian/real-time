import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

interface SigninPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  email: string;
  password: string;
  role?: string;
}

export const useSignin = () =>
  useMutation({
    mutationFn: (data: SigninPayload) => api.post("auth/signin", data),
  });

export const useSignup = () =>
  useMutation({
    mutationFn: (data: SignupPayload) => api.post("auth/signup", data),
  });
