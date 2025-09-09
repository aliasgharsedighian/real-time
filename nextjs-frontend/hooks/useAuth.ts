import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

interface SigninPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  email: string;
  password: string;
  role?: string;
}

interface UpdateProfile {
  firstname?: string;
  lastname?: string;
}

export const useSignin = () =>
  useMutation({
    mutationFn: (data: SigninPayload) => api.post("auth/signin", data),
  });

export const useSignup = () =>
  useMutation({
    mutationFn: (data: SignupPayload) => api.post("auth/signup", data),
  });

export const logoutUser = (token: string | null) =>
  useMutation({
    mutationFn: async () => {
      return api.post("auth/logout", null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
  });

export const useUpdateProfile = (token: string | null) =>
  useMutation({
    mutationFn: (data: UpdateProfile) =>
      api.put("auth/update-profile", data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
  });
