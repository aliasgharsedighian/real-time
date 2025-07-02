import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";

interface LoginPayload {
  email: string;
  password: string;
}

export const useLogin = () =>
  useMutation({
    mutationFn: (data: LoginPayload) => api.post("auth/signin", data),
  });
