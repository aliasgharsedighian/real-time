import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "./SessionProvider";
import { useSession } from "./session-context";
import { useSessionStore } from "./session-store";
import { getCurrentUser } from "./api";
import { ApiError } from "@/shared/lib/api";

vi.mock("./api", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/chat/socket", () => ({ disconnectSocket: vi.fn() }));

function State() {
  const session = useSession();
  return (
    <p>
      {session.checking
        ? "Checking"
        : session.user
          ? `User ${session.user.id}`
          : session.error
            ? "Retry available"
            : "Guest"}
    </p>
  );
}
function mount() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider>
        <State />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

describe("restored sessions", () => {
  beforeEach(() => {
    useSessionStore.getState().clear();
    vi.mocked(getCurrentUser).mockReset();
  });
  it("validates a persisted token before exposing the user", async () => {
    useSessionStore
      .getState()
      .setTokens({ accessToken: "stored", refreshToken: "refresh" });
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 9,
      email: null,
      profile: null,
    });
    mount();
    expect(screen.getByText("Checking")).toBeTruthy();
    expect(await screen.findByText("User 9")).toBeTruthy();
  });
  it("clears a rejected session", async () => {
    useSessionStore
      .getState()
      .setTokens({ accessToken: "invalid", refreshToken: "refresh" });
    vi.mocked(getCurrentUser).mockRejectedValue(new ApiError("Expired", 401));
    mount();
    await waitFor(() => expect(useSessionStore.getState().tokens).toBeNull());
    expect(await screen.findByText("Guest")).toBeTruthy();
  });
  it("preserves credentials when the server is temporarily unreachable", async () => {
    useSessionStore
      .getState()
      .setTokens({ accessToken: "stored", refreshToken: "refresh" });
    vi.mocked(getCurrentUser).mockRejectedValue(
      new Error("Network unavailable"),
    );
    mount();
    expect(await screen.findByText("Retry available")).toBeTruthy();
    expect(useSessionStore.getState().tokens?.accessToken).toBe("stored");
  });
});
