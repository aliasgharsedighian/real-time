import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatStatus } from "./ChatStatus";

const fake = vi.hoisted(() => ({
  handlers: new Map<string, (data?: unknown) => void>(),
  emit: vi.fn(),
}));
vi.mock("@/features/auth/session-context", () => ({
  useSession: () => ({ user: { id: 1 } }),
}));
vi.mock("../socket", () => ({
  getSocket: () => ({
    connected: true,
    emit: fake.emit,
    on: (event: string, callback: (data?: unknown) => void) =>
      fake.handlers.set(event, callback),
    off: (event: string) => fake.handlers.delete(event),
  }),
}));
const event = (name: string, data?: unknown) =>
  act(() => fake.handlers.get(name)?.(data));
const presence = (online: boolean) =>
  event("chat:presence", {
    chatId: 3,
    users: [
      { userId: 2, online, lastSeenAt: null, lastSeen: online ? null : "week" },
    ],
  });
describe("chat header status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.handlers.clear();
    fake.emit.mockClear();
  });
  afterEach(() => vi.useRealTimers());
  it("replaces last seen with typing, restores online, then applies privacy changes live", () => {
    render(<ChatStatus chatId={3} peerId={2} />);
    expect(fake.emit).toHaveBeenCalledWith("chat:presence", { chatId: 3 });
    presence(false);
    expect(screen.getByText("last seen within a week")).toBeTruthy();
    presence(true);
    event("typing:start", { chatId: 3, userId: 2, username: "Alice" });
    expect(screen.getByText("is typing")).toBeTruthy();
    expect(screen.queryByText(/Alice/)).toBeNull();
    expect(screen.queryByText("online")).toBeNull();
    event("typing:stop", { chatId: 3, userId: 2 });
    expect(screen.getByText("online")).toBeTruthy();
    presence(false);
    expect(screen.getByText("last seen within a week")).toBeTruthy();
  });
  it("ignores other rooms and the viewer, keeps typing through idle and clears on disconnect", () => {
    render(<ChatStatus chatId={3} peerId={2} />);
    presence(true);
    event("typing:start", { chatId: 4, userId: 2, username: "Other chat" });
    event("typing:start", { chatId: 3, userId: 1, username: "Me" });
    expect(screen.getByText("online")).toBeTruthy();
    event("typing:start", { chatId: 3, userId: 2, username: "Alice" });
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("is typing")).toBeTruthy();
    event("disconnect");
    expect(screen.queryByText("online")).toBeNull();
    fake.emit.mockClear();
    event("connect");
    expect(fake.emit).toHaveBeenCalledWith("chat:presence", { chatId: 3 });
  });
  it("uses the same line for group typing and member information", () => {
    render(<ChatStatus chatId={3} groupLabel="3 members · Group info" />);
    event("typing:start", { chatId: 3, userId: 2, username: "Alice" });
    expect(screen.getByText("Alice is typing")).toBeTruthy();
    event("typing:start", { chatId: 3, userId: 3, username: "Bob" });
    event("typing:start", { chatId: 3, userId: 4, username: "Carol" });
    event("typing:start", { chatId: 3, userId: 2, username: "Alice" });
    expect(screen.getByText("Alice, Bob, Carol is typing")).toBeTruthy();
    event("typing:stop", { chatId: 3, userId: 3 });
    expect(screen.getByText("Alice, Carol is typing")).toBeTruthy();
    event("typing:stop", { chatId: 3, userId: 2 });
    event("typing:stop", { chatId: 3, userId: 4 });
    expect(screen.getByText("3 members · Group info")).toBeTruthy();
  });
});
