import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/features/auth/session-store";
import { formatMessageDay } from "@/shared/lib/date";
import { getMessageDays } from "../api";
import { ChatDateNavigation } from "./ChatDateNavigation";
vi.mock("../api", async (original) => ({
  ...(await original<object>()),
  getMessageDays: vi.fn(),
}));
const getDays = vi.mocked(getMessageDays);
function mount(onSelect = vi.fn().mockResolvedValue(undefined)) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ChatDateNavigation chatId={7} day="2026-11-04" onSelect={onSelect} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Jump to date/ }));
  return onSelect;
}
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore
    .getState()
    .setTokens({ accessToken: "access", refreshToken: "refresh" });
  getDays.mockResolvedValue({
    days: [
      { date: "2026-11-03", messageId: 30 },
      { date: "2026-11-04", messageId: 40 },
    ],
  });
});
describe("message calendar", () => {
  it("enables server-provided message days and opens the first message of the chosen date", async () => {
    const select = mount();
    const day = await screen.findByRole("button", {
      name: formatMessageDay("2026-11-03"),
    });
    expect(
      (
        screen.getByRole("button", {
          name: formatMessageDay("2026-11-05"),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(day);
    await waitFor(() => expect(select).toHaveBeenCalledWith(30));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Close" })).toBeNull(),
    );
    expect(getDays.mock.calls[0][0]).toBe(7);
  });
  it("fetches another month from the server instead of using only loaded messages", async () => {
    mount();
    await screen.findByRole("button", { name: formatMessageDay("2026-11-03") });
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => expect(getDays).toHaveBeenCalledTimes(2));
    expect(getDays.mock.calls[1][1].from).toBe(
      new Date(2026, 9, 1).toISOString(),
    );
    expect(getDays.mock.calls[1][1].to).toBe(
      new Date(2026, 10, 1).toISOString(),
    );
  });
  it("keeps the calendar open when navigating fails and allows retry", async () => {
    const select = vi
      .fn()
      .mockRejectedValueOnce(new Error("Cannot open this date"))
      .mockResolvedValue(undefined);
    mount(select);
    const day = await screen.findByRole("button", {
      name: formatMessageDay("2026-11-03"),
    });
    fireEvent.click(day);
    await screen.findByText("Cannot open this date");
    fireEvent.click(day);
    await waitFor(() => expect(select).toHaveBeenCalledTimes(2));
  });
  it("can retry loading calendar dates after a network error", async () => {
    getDays.mockRejectedValueOnce(new Error("Dates unavailable"));
    mount();
    await screen.findByText("Dates unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: formatMessageDay("2026-11-03") });
  });
});
