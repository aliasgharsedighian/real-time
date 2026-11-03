import { api, publicApi, unwrap } from "@/shared/lib/api";
import type { ApiResponse, User } from "@/shared/lib/types";
import type { Tokens } from "./session-store";

export interface Credentials {
  email: string;
  password: string;
}

export async function authenticate(
  mode: "signin" | "signup",
  credentials: Credentials,
) {
  if (mode === "signup") {
    const { data } = await publicApi.post<ApiResponse<{ token: Tokens }>>(
      "auth/signup",
      { ...credentials, role: "USER" },
    );
    return unwrap(data).token;
  }
  const { data } = await publicApi.post<ApiResponse<Tokens>>(
    "auth/signin",
    credentials,
  );
  return unwrap(data);
}

export async function getCurrentUser(signal?: AbortSignal) {
  const { data } = await api.get<ApiResponse<User>>("auth/user-info", {
    signal,
  });
  const user = unwrap(data);
  if (!user?.id) throw new Error("The server returned an invalid session.");
  return user;
}
