import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, publicApi } from "./api";
import { useSessionStore } from "@/features/auth/session-store";

const originalAdapter = api.defaults.adapter;
const originalPublicAdapter = publicApi.defaults.adapter;
function response(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) {
  return {
    config,
    data,
    status,
    statusText: String(status),
    headers: new AxiosHeaders(),
  };
}
function reject(config: InternalAxiosRequestConfig): never {
  throw new AxiosError(
    "Unauthorized",
    "ERR_BAD_REQUEST",
    config,
    undefined,
    response(config, {}, 401),
  );
}

describe("authenticated HTTP", () => {
  beforeEach(() =>
    useSessionStore
      .getState()
      .setTokens({ accessToken: "old", refreshToken: "refresh" }),
  );
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    publicApi.defaults.adapter = originalPublicAdapter;
    useSessionStore.getState().clear();
  });
  it("shares one refresh for simultaneous expired requests and retries with the new bearer token", async () => {
    const refresh: AxiosAdapter = vi.fn(async (config) =>
      response(config, { accessToken: "new" }),
    );
    publicApi.defaults.adapter = refresh;
    api.defaults.adapter = async (config) =>
      config.headers.Authorization === "Bearer old"
        ? reject(config)
        : response(config, { ok: true });
    const results = await Promise.all([api.get("first"), api.get("second")]);
    expect(results.map((result) => result.data)).toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().tokens?.accessToken).toBe("new");
  });
  it("clears credentials when refresh is rejected", async () => {
    api.defaults.adapter = async (config) => reject(config);
    publicApi.defaults.adapter = async (config) => reject(config);
    await expect(api.get("private")).rejects.toThrow("Unauthorized");
    expect(useSessionStore.getState().tokens).toBeNull();
  });
  it("never restores an old session after logout during refresh", async () => {
    api.defaults.adapter = async (config) => reject(config);
    publicApi.defaults.adapter = async (config) => {
      useSessionStore.getState().clear();
      return response(config, { accessToken: "must-not-restore" });
    };
    await expect(api.get("private")).rejects.toThrow("Session changed.");
    expect(useSessionStore.getState().tokens).toBeNull();
  });
});
