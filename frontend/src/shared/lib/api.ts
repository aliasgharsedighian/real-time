import axios from "axios";
import { env } from "./env";
import { useSessionStore } from "@/features/auth/session-store";
import type { ApiResponse } from "./types";

declare module "axios" {
  interface AxiosRequestConfig {
    _retried?: boolean;
    _sessionIdentity?: string;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export const publicApi = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 15000,
});
export const api = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const tokens = useSessionStore.getState().tokens;
  if (
    config._sessionIdentity &&
    config._sessionIdentity !== tokens?.refreshToken
  ) {
    throw new axios.CanceledError("Session changed.");
  }
  config._sessionIdentity = tokens?.refreshToken;
  if (tokens) config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  return config;
});

const refreshes = new Map<string, Promise<string>>();

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  const session = useSessionStore.getState().tokens;
  if (error.response?.status !== 401 || !config || config._retried || !session)
    throw error;
  if (config._sessionIdentity !== session.refreshToken)
    throw new axios.CanceledError("Session changed.");
  config._retried = true;
  if (config.headers.Authorization !== `Bearer ${session.accessToken}`)
    return api.request(config);
  let refreshing = refreshes.get(session.refreshToken);
  if (!refreshing) {
    refreshing = publicApi
      .post<{ accessToken: string }>("auth/refresh-token", {
        refreshToken: session.refreshToken,
      })
      .then(({ data }) => {
        if (!data.accessToken) throw new ApiError("Please sign in again.", 401);
        // An old request must never restore credentials after logout/account change.
        if (
          useSessionStore.getState().tokens?.refreshToken !==
          session.refreshToken
        )
          throw new ApiError("Session changed.", 401);
        useSessionStore
          .getState()
          .setTokens({ ...session, accessToken: data.accessToken });
        return data.accessToken;
      })
      .catch((refreshError: unknown) => {
        if (
          (axios.isAxiosError(refreshError) &&
            refreshError.response?.status === 401) ||
          (refreshError instanceof ApiError && refreshError.status === 401)
        ) {
          if (
            useSessionStore.getState().tokens?.refreshToken ===
            session.refreshToken
          )
            useSessionStore.getState().clear();
        }
        throw refreshError;
      })
      .finally(() => {
        refreshes.delete(session.refreshToken);
      });
    refreshes.set(session.refreshToken, refreshing);
  }
  const token = await refreshing;
  config.headers.Authorization = `Bearer ${token}`;
  return api.request(config);
});

export function unwrap<T>(response: ApiResponse<T>): T {
  const status = response.statusCode ?? response.status ?? 200;
  if (status >= 400)
    throw new ApiError(response.message || "Request failed.", status);
  return response.data;
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(" · ");
    if (typeof message === "string") return message;
    return error.response
      ? "The request failed. Please try again."
      : "Cannot reach the server. Check your connection and try again.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function isUnauthorized(error: unknown) {
  return (
    (axios.isAxiosError(error) && error.response?.status === 401) ||
    (error instanceof ApiError && error.status === 401)
  );
}
