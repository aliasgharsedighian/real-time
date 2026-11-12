import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { SessionContext } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import NotificationProvider from "./NotificationProvider";
import { NotificationSettings } from "./NotificationSettings";
const fake = vi.hoisted(() => ({
  events: new Map<string, (data: unknown) => void>(),
  emit: vi.fn(),
  play: vi.fn(),
  connect: vi.fn().mockRejectedValue(new Error("Google blocked")),
  deliver: vi.fn().mockRejectedValue(new Error("No worker")),
}));
vi.mock("@/shared/lib/app-sounds", () => ({ listenForSoundActivation: () => undefined, playAppSound: fake.play }));
vi.mock("@/features/chat/socket", () => ({ getSocket: () => ({ connected: true,
  emit: fake.emit, on: (name: string, handler: (data: unknown) => void) => fake.events.set(name, handler),
  off: (name: string) => fake.events.delete(name),
}) }));
vi.mock("@/shared/lib/api", () => ({ api: { get: async () => ({ data: { pushConfigured: true } }) } }));
vi.mock("@/features/chat/api", () => ({
  chatKeys: { list: () => ["chats"] },
  getChats: async () => [
    { id: 7, isGroup: true, avatarId: "group-avatar", participants: [] },
    { id: 8, isGroup: false, participants: [{ userId: 1, user: { profile: { avatarId: "sender-avatar" } } }] },
  ],
}));
vi.mock("@/features/uploads/Media", () => ({
  useFileUrl: (id?: string) => ({ url: id ? `blob:${id}` : undefined }),
}));
vi.mock("./config", () => ({ pushConfigured: true }));
vi.mock("./browser-push", () => ({
  browserSupportsPush: () => true, preference: () => false, setPreference: vi.fn(),
  workerMessage: async () => {}, disableBrowserPush: async () => {},
  connectBrowserPush: fake.connect, deliverThroughWorker: fake.deliver,
}));
const notification = { type: "chat.message", messageId: "99", chatId: "7", recipientId: "2", senderId: "1",
  title: "Bat family", body: "Bruce: 📷 Photo · Gotham", senderName: "Bruce", mediaKind: "IMAGE", createdAt: new Date().toISOString() };
function mount() {
  const cache = new QueryClient();
  return render(<QueryClientProvider client={cache}><BrowserRouter><SessionContext value={{ user: { id: 2, email: "me@test.invalid", profile: null }, checking: false, error: null, retry: vi.fn() }}>
    <NotificationProvider><p>Chat works</p><NotificationSettings /></NotificationProvider>
  </SessionContext></BrowserRouter></QueryClientProvider>);
}
beforeEach(() => {
  fake.events.clear(); fake.emit.mockClear(); fake.deliver.mockClear(); fake.play.mockClear();
  window.history.replaceState(null, "", "/dashboard");
  useSessionStore.getState().setTokens({ accessToken: "access", refreshToken: "refresh" });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "granted", requestPermission: async () => "granted" } });
});
afterEach(() => vi.useRealTimers());

describe("in-app notifications with Firebase unavailable", () => {
  it("opens a media toast in a visible, unfocused window and deduplicates delivery", async () => {
    vi.mocked(document.hasFocus).mockReturnValue(false);
    window.history.replaceState(null, "", "/dashboard/websocket/8");
    mount();
    act(() => fake.events.get("notification:new")!(notification));
    await screen.findByRole("button", { name: "Open conversation: Bat family" });
    act(() => fake.events.get("notification:new")!(notification));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Open conversation: Bat family" })).toHaveLength(1));
    expect(screen.getByText(/Photo · Gotham/)).toBeTruthy();
    expect(fake.deliver).not.toHaveBeenCalled();
    expect(fake.play).toHaveBeenCalledExactlyOnceWith("messageReceived");
    fireEvent.click(screen.getByRole("button", { name: "Open conversation: Bat family" }));
    expect(window.location.pathname).toBe("/dashboard/websocket/7");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open conversation: Bat family" })).toBeNull());
    expect(fake.emit).toHaveBeenLastCalledWith("notification:presence", { active: true, chatId: 7 });
  });
  it("uses the group or sender photo and falls back to initials", async () => {
    mount();
    act(() => {
      const receive = fake.events.get("notification:new")!;
      receive(notification);
      receive({ ...notification, chatId: "8", messageId: "100", title: "Bruce Wayne" });
      receive({ ...notification, chatId: "9", messageId: "101", title: "Diana Prince" });
    });
    const avatarSrc = (title: string) => screen.getByRole("button", {
      name: `Open conversation: ${title}`,
    }).closest("article")?.querySelector("img")?.getAttribute("src");
    await waitFor(() => {
      expect(avatarSrc("Bat family")).toBe("blob:group-avatar");
      expect(avatarSrc("Bruce Wayne")).toBe("blob:sender-avatar");
    });
    expect(screen.getByText("DP")).toBeTruthy();
  });
  it("closes with the X and expires the next toast automatically", async () => {
    mount();
    act(() => fake.events.get("notification:new")!(notification));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Dismiss notification" })).toBeNull());
    expect(window.location.pathname).toBe("/dashboard");

    vi.useFakeTimers();
    await act(async () => {
      fake.events.get("notification:new")!({ ...notification, messageId: "100" });
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(8500));
    expect(screen.queryByRole("button", { name: "Dismiss notification" })).toBeNull();
  });

  it("dismisses an upward swipe without opening the chat", async () => {
    mount();
    act(() => fake.events.get("notification:new")!(notification));
    const preview = await screen.findByText(/Photo · Gotham/);
    Object.defineProperty(preview, "setPointerCapture", { value: vi.fn() });
    const pointer = (type: string, y: number) =>
      fireEvent(preview, new MouseEvent(type, { bubbles: true, clientX: 60, clientY: y }));
    pointer("pointerdown", 150);
    pointer("pointermove", 120);
    pointer("pointermove", 60);
    pointer("pointerup", 60);
    fireEvent.click(preview);
    expect(window.location.pathname).toBe("/dashboard");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Dismiss notification" })).toBeNull());
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
    expect(fake.play).not.toHaveBeenCalled();
  });
});
