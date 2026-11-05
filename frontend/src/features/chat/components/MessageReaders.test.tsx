import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MessageInteraction } from "./MessageActions";
import { MessageReaders } from "./MessageReaders";
import { chatKeys } from "../api";
import type { MessageReader } from "../types";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api", async (original) => ({
  ...(await original<object>()),
  getMessageReaders: mocks.get,
}));
vi.mock("@/features/uploads/Media", () => ({
  useFileUrl: (id?: string) => ({ url: id ? `blob:${id}` : undefined }),
}));
const message = {
  id: 9,
  chatId: 7,
  senderId: 1,
  content: "Our message",
  createdAt: "2026-11-05T10:00:00Z",
};
function readers(count: number): MessageReader[] {
  return Array.from({ length: count }, (_, i) => ({
    messageId: 9,
    userId: i + 2,
    readAt: `2026-11-05T10:0${i}:00Z`,
    user: {
      id: i + 2,
      email: null,
      profile: {
        firstname: `Reader ${i + 1}`,
        lastname: null,
        avatarId: `avatar-${i}`,
      },
    },
  }));
}
function mount(own = true) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MessageInteraction
        message={message}
        own={own}
        canDelete={own}
        selecting={false}
        selected={false}
        onToggle={vi.fn()}
        onReply={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onForward={vi.fn()}
      >
        <p>Our message</p>
      </MessageInteraction>
    </QueryClientProvider>,
  );
  return cache;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(readers(5));
});
describe("message readers", () => {
  it("opens from right click, limits the avatar stack to four, and opens a small panel with names and exact times", async () => {
    mount();
    fireEvent.contextMenu(screen.getByText("Our message"), {
      clientX: 250,
      clientY: 300,
    });
    const seen = await screen.findByRole("menuitem", {
      name: "5 Seen · View readers",
    });
    expect(seen.querySelectorAll("img")).toHaveLength(4);
    fireEvent.click(seen);
    const panel = await screen.findByRole("region", {
      name: "Message readers",
    });
    expect(within(panel).getAllByRole("listitem")).toHaveLength(5);
    expect(within(panel).getByText("Reader 5")).toBeTruthy();
    expect(panel.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-11-05T10:00:00Z",
    );
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.getByRole("menu")).toBeTruthy();
  });
  it("refreshes reader details when receipts invalidate the cache", async () => {
    const cache = mount();
    fireEvent.click(screen.getByLabelText("Message actions 9"));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "5 Seen · View readers" }),
    );
    mocks.get.mockResolvedValue(readers(6));
    await cache.invalidateQueries({
      queryKey: chatKeys.readers(undefined, 7, 9),
    });
    await screen.findByText("Reader 6");
  });
  it("shows an empty state and lets failed requests retry", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Readers unavailable"));
    mount();
    fireEvent.click(screen.getByLabelText("Message actions 9"));
    await screen.findByText("Seen details");
    fireEvent.click(
      screen.getByRole("menuitem", { name: "0 Seen · View readers" }),
    );
    await screen.findByText("Readers unavailable");
    mocks.get.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Retry readers" }));
    await screen.findByText("No one has seen this message yet.");
  });
  it("does not expose reader details for someone else’s message", () => {
    mount(false);
    fireEvent.contextMenu(screen.getByText("Our message"));
    expect(screen.queryByText(/Seen/)).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("keeps compact status lazy until the sender opens it", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MessageReaders message={message} compact />
      </QueryClientProvider>,
    );
    expect(mocks.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Seen details for message 9"));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    await screen.findByText("Reader 1");
  });
});
