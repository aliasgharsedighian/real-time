import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Providers } from "./providers";
import { routes } from "./router";
import { authenticate, getCurrentUser } from "@/features/auth/api";
import { useSessionStore } from "@/features/auth/session-store";

vi.mock("@/features/auth/api", () => ({
  authenticate: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/features/chat/socket", () => {
  const socket = {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    timeout: () => socket,
    emitWithAck: async () => [],
  };
  return { getSocket: () => socket, disconnectSocket: vi.fn() };
});

describe("application routes", () => {
  beforeEach(() => {
    useSessionStore.getState().clear();
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      email: "user@example.test",
      profile: null,
    });
    vi.mocked(authenticate).mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });
  it("renders the migrated landing page independently of Next", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );
    expect(await screen.findByText("Chat smarter.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Start Chatting Free" }),
    ).toBeTruthy();
  });
  it("returns to a protected deep link after signing in and validating the session", async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ["/dashboard/profile"],
    });
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Start Chatting Free" }),
    );
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Signin" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/dashboard/profile"),
    );
    expect(await screen.findByText("Update your profile")).toBeTruthy();
    expect(authenticate).toHaveBeenCalledWith("signin", {
      email: "user@example.test",
      password: "password123",
    });
    expect(getCurrentUser).toHaveBeenCalled();
  });
});
