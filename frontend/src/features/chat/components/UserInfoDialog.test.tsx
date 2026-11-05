import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { UserInfoDialog } from "./UserInfoDialog";
import { createChat, getUserProfile, muteChat } from "../api";
const state = vi.hoisted(() => ({ direct: false }));
vi.mock("../api", () => ({
  chatKeys: { list: () => ["chats"] },
  getUserProfile: vi.fn(),
  createChat: vi.fn(),
  muteChat: vi.fn(),
}));
vi.mock("../hooks/use-chat-list", () => ({
  useChatList: () => ({
    data: state.direct
      ? [
          {
            id: 10,
            isGroup: false,
            muted: false,
            participants: [{ userId: 2 }],
          },
        ]
      : [],
  }),
}));
vi.mock("./SharedContentSection", () => ({
  SharedContentSection: ({ chatId }: { chatId: number }) => (
    <p>Shared conversation {chatId}</p>
  ),
}));
vi.mock("./ChatStatus", () => ({
  ChatStatus: () => <p>last seen recently</p>,
}));
vi.mock("@/features/calls/CallButton", () => ({
  CallButton: () => <button>Start a call</button>,
}));
vi.mock("@/features/auth/session-context", () => ({
  useSession: () => ({ user: { id: 1 } }),
}));
vi.mock("@/features/uploads/Media", () => ({ useFileUrl: () => ({}) }));
function Location() {
  return <p>{useLocation().pathname}</p>;
}
function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <UserInfoDialog userId={2}>Open profile</UserInfoDialog>
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.direct = false;
  vi.mocked(getUserProfile).mockResolvedValue({
    id: 2,
    email: "person@example.invalid",
    phoneNumber: "+123456",
    profile: {
      id: 2,
      firstname: "Test",
      lastname: "Person",
      address: "Existing address",
    },
  });
});
it("opens the existing user profile and starts a direct conversation through Message", async () => {
  vi.mocked(createChat).mockResolvedValue({
    id: 10,
    isGroup: false,
    createdAt: "2026-11-05",
    participants: [],
    messages: [],
  });
  setup();
  expect(getUserProfile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
  await screen.findByRole("heading", { name: "Test Person" });
  expect(screen.getByText("Existing address")).toBeTruthy();
  expect(screen.queryByText("Username")).toBeNull();
  expect(screen.queryByRole("button", { name: "Mute" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Message" }));
  await screen.findByText("/dashboard/websocket/10");
  expect(createChat).toHaveBeenCalledWith([2]);
});
it("shows existing shared content, mute and call actions for an existing direct conversation", async () => {
  state.direct = true;
  vi.mocked(muteChat).mockResolvedValue(undefined);
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Open profile" }));
  await screen.findByText("Shared conversation 10");
  expect(screen.getByRole("button", { name: "Start a call" })).toBeTruthy();
  expect(screen.getByText("last seen recently")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mute" }));
  await waitFor(() => expect(muteChat).toHaveBeenCalledWith(10, true));
});
