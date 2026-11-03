import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { SessionContext, type SessionContextValue } from "./session-context";
import { useSessionStore } from "./session-store";

function LoginDestination() {
  const location = useLocation();
  return <p>Sign in to return to {location.state?.from}</p>;
}
function mount(session: Partial<SessionContextValue> = {}) {
  return render(
    <SessionContext.Provider
      value={{
        user: null,
        checking: false,
        error: null,
        retry: vi.fn(),
        ...session,
      }}
    >
      <MemoryRouter initialEntries={["/dashboard/websocket/42?source=inbox"]}>
        <Routes>
          <Route path="/login" element={<LoginDestination />} />
          <Route element={<ProtectedRoute />}>
            <Route
              path="/dashboard/websocket/:chatId"
              element={<p>Private messages</p>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}

describe("protected routes", () => {
  beforeEach(() => useSessionStore.getState().clear());
  it("redirects guests and preserves their intended deep link", () => {
    mount();
    expect(
      screen.getByText(
        "Sign in to return to /dashboard/websocket/42?source=inbox",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Private messages")).toBeNull();
  });
  it("does not render private content while the stored token is being validated", () => {
    useSessionStore
      .getState()
      .setTokens({ accessToken: "stored", refreshToken: "refresh" });
    mount({ checking: true });
    expect(screen.getByRole("status").textContent).toContain(
      "Checking your session",
    );
    expect(screen.queryByText("Private messages")).toBeNull();
  });
  it("renders private content only with an API-validated user", () => {
    useSessionStore
      .getState()
      .setTokens({ accessToken: "valid", refreshToken: "refresh" });
    mount({ user: { id: 1, email: "user@example.test", profile: null } });
    expect(screen.getByText("Private messages")).toBeTruthy();
  });
  it("keeps a network failure recoverable without treating the user as a guest", () => {
    const retry = vi.fn();
    useSessionStore
      .getState()
      .setTokens({ accessToken: "stored", refreshToken: "refresh" });
    mount({ error: new Error("Network unavailable"), retry });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().tokens?.accessToken).toBe("stored");
    expect(screen.queryByText("Private messages")).toBeNull();
  });
  it("blocks content immediately after logout", () => {
    useSessionStore
      .getState()
      .setTokens({ accessToken: "valid", refreshToken: "refresh" });
    mount({
      user: { id: 1, email: null, profile: null },
      error: new Error("Session failed"),
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(screen.getByText(/Sign in to return to/)).toBeTruthy();
  });
});
