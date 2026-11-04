import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/features/auth/session-store";
import { searchMessages } from "../api";
import { MessageSearchProvider } from "../message-search-context";
import { MessageSearchPanel } from "./MessageSearchPanel";
vi.mock("../api", async (original) => ({
  ...(await original<object>()),
  searchMessages: vi.fn(),
}));
vi.mock("@/features/uploads/Media", () => ({ useFileUrl: () => ({}) }));
const search = vi.mocked(searchMessages);
const message = (id: number, content = "A searchable needle") => ({
  id,
  chatId: 7,
  senderId: 2,
  createdAt: "2026-11-04T10:00:00Z",
  content,
  sender: { id: 2, email: "alice@test.invalid", profile: null },
});
function mount(onSelect = vi.fn().mockResolvedValue(undefined)) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MessageSearchProvider>
        <MessageSearchPanel
          chatId={7}
          title="Project group"
          onSelect={onSelect}
        />
      </MessageSearchProvider>
    </QueryClientProvider>,
  );
  return {
    field: screen.getByRole("textbox", { name: "Search message text" }),
    onSelect,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore
    .getState()
    .setTokens({ accessToken: "access", refreshToken: "refresh" });
});
describe("server message search panel", () => {
  it("cancels an obsolete search and never renders its stale results", async () => {
    search
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({
        messages: [message(12, "newterm result")],
        nextCursor: null,
      });
    const { field } = mount();
    fireEvent.change(field, { target: { value: "oldterm" } });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    const signal = search.mock.calls[0][3]!;
    fireEvent.change(field, { target: { value: "newterm" } });
    await screen.findByText("newterm", { selector: "mark" });
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText("oldterm")).toBeNull();
  });
  it("debounces typing and never searches short or unindexable input", async () => {
    search.mockResolvedValue({ messages: [], nextCursor: null });
    const { field } = mount();
    expect(field).toBe(document.activeElement);
    fireEvent.change(field, { target: { value: "ab" } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(search).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "nee" } });
    fireEvent.change(field, { target: { value: "needle" } });
    await screen.findByText("No matching messages");
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(
      7,
      "needle",
      undefined,
      expect.any(AbortSignal),
    );
  });
  it("renders sender, highlighted server excerpts and further pages, and opens the selected message", async () => {
    search
      .mockResolvedValueOnce({ messages: [message(91)], nextCursor: 91 })
      .mockResolvedValueOnce({
        messages: [message(12, "An older needle")],
        nextCursor: null,
      });
    const { field, onSelect } = mount();
    fireEvent.change(field, { target: { value: "needle" } });
    await screen.findByText("alice@test.invalid");
    expect(screen.getByText("needle", { selector: "mark" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more results" }));
    await screen.findByText("2 messages found");
    expect(search.mock.calls[1][2]).toBe(91);
    const hits = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.includes("alice@test.invalid"));
    fireEvent.click(hits[1]);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(12));
    expect(screen.getByText("Project group")).toBeTruthy();
  });
  it("keeps results available when opening a message fails", async () => {
    search.mockResolvedValue({ messages: [message(42)], nextCursor: null });
    const onSelect = vi
      .fn()
      .mockRejectedValueOnce(new Error("Message unavailable"))
      .mockResolvedValue(undefined);
    const { field } = mount(onSelect);
    fireEvent.change(field, { target: { value: "needle" } });
    const sender = await screen.findByText("alice@test.invalid");
    fireEvent.click(sender.closest("button")!);
    await screen.findByRole("alert");
    expect(screen.getByText("Message unavailable")).toBeTruthy();
    fireEvent.click(sender.closest("button")!);
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
  });
  it("can retry server failures and clear the search without retaining old results", async () => {
    search
      .mockRejectedValueOnce(new Error("Search offline"))
      .mockResolvedValueOnce({ messages: [message(4)], nextCursor: null });
    const { field } = mount();
    fireEvent.change(field, { target: { value: "needle" } });
    await screen.findByText("Search offline");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("alice@test.invalid");
    fireEvent.click(
      screen.getByRole("button", { name: "Clear message search" }),
    );
    expect(screen.queryByText("alice@test.invalid")).toBeNull();
    expect((field as HTMLInputElement).value).toBe("");
  });
});
