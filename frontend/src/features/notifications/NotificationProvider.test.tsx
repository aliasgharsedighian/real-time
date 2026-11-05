import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { SessionContext } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import NotificationProvider from "./NotificationProvider";
import { NotificationSettings } from "./NotificationSettings";
const fake = vi.hoisted(() => ({
  events: new Map<string, (data: unknown) => void>(),
  emit: vi.fn(),
  connect: vi.fn().mockRejectedValue(new Error("Google blocked")),
  deliver: vi.fn().mockRejectedValue(new Error("No worker")),
}));
vi.mock("@/features/chat/socket", () => ({ getSocket: () => ({ connected: true,
  emit: fake.emit, on: (name: string, handler: (data: unknown) => void) => fake.events.set(name, handler),
  off: (name: string) => fake.events.delete(name),
}) }));
vi.mock("@/shared/lib/api", () => ({ api: { get: async () => ({ data: { pushConfigured: true } }) } }));
vi.mock("./config", () => ({ pushConfigured: true }));
vi.mock("./browser-push", () => ({
  browserSupportsPush: () => true, preference: () => false, setPreference: vi.fn(),
  workerMessage: async () => {}, disableBrowserPush: async () => {},
  connectBrowserPush: fake.connect, deliverThroughWorker: fake.deliver,
}));
const notification = { type: "chat.message", messageId: "99", chatId: "7", recipientId: "2", senderId: "1",
  title: "Bat family", body: "Bruce: 📷 Photo · Gotham", senderName: "Bruce", mediaKind: "IMAGE", createdAt: new Date().toISOString() };
function mount() {
  return render(<BrowserRouter><SessionContext value={{ user: { id: 2, email: "me@test.invalid", profile: null }, checking: false, error: null, retry: vi.fn() }}>
    <NotificationProvider><p>Chat works</p><NotificationSettings /></NotificationProvider>
  </SessionContext></BrowserRouter>);
}
beforeEach(() => {
  fake.events.clear(); fake.emit.mockClear(); fake.deliver.mockClear();
  window.history.replaceState(null, "", "/dashboard");
  useSessionStore.getState().setTokens({ accessToken: "access", refreshToken: "refresh" });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "granted", requestPermission: async () => "granted" } });
});
describe("in-app notifications with Firebase unavailable", () => {
  it("renders and opens the media banner, deduplicating repeated delivery", async () => {
    mount();
    act(() => fake.events.get("notification:new")!(notification));
    await screen.findByRole("button", { name: "Open conversation: Bat family" });
    act(() => fake.events.get("notification:new")!(notification));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Open conversation: Bat family" })).toHaveLength(1));
    expect(screen.getByText(/Photo · Gotham/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open conversation: Bat family" }));
    expect(window.location.pathname).toBe("/dashboard/websocket/7");
    expect(screen.queryByRole("button", { name: "Open conversation: Bat family" })).toBeNull();
    expect(fake.emit).toHaveBeenLastCalledWith("notification:presence", { active: true, chatId: 7 });
  });
  it("silences the open chat, background pages, own messages and other accounts", async () => {
    mount();
    for (const value of [{ ...notification, senderId: "2" }, { ...notification, recipientId: "3" }]) {
      act(() => fake.events.get("notification:new")!(value));
    }
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Open conversation:/ })).toBeNull();
    window.history.replaceState(null, "", "/dashboard/websocket/7");
    act(() => fake.events.get("notification:new")!(notification));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Open conversation:/ })).toBeNull();
    window.history.replaceState(null, "", "/dashboard");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => fake.events.get("notification:new")!(notification));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /Open conversation:/ })).toBeNull();
  });
});
