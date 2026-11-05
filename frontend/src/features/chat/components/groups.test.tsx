import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NewChatDialog } from "./NewChatDialog";
import { GroupInfoDialog } from "./GroupInfoDialog";
import type { ChatDetails } from "../types";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  add: vi.fn(),
  upload: vi.fn(),
  search: vi.fn(),
  remove: vi.fn(),
  transfer: vi.fn(),
  userId: 1,
}));
vi.mock("@/features/auth/session-context", () => ({
  useSession: () => ({
    user: { id: mocks.userId, email: "me@example.invalid", profile: null },
  }),
}));
vi.mock("../api", async (original) => ({
  ...(await original<object>()),
  getChats: vi.fn(async () => []),
  getSharedContent: vi.fn(async () => ({
    counts: { IMAGE: 0, VIDEO: 0, AUDIO: 0, LINK: 0 },
    messages: [],
    nextCursor: null,
  })),
  searchUsers: mocks.search,
  createChat: mocks.create,
  addGroupMembers: mocks.add,
  removeGroupMember: mocks.remove,
  transferGroupOwner: mocks.transfer,
}));
vi.mock("@/features/uploads/api", async (original) => ({
  ...(await original<object>()),
  uploadFile: mocks.upload,
  useUploadPolicy: () => ({
    data: {
      avatarMaxBytes: 5 * 1024 * 1024,
      imageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    },
  }),
}));
vi.mock("@/features/uploads/Media", () => ({
  useFileUrl: () => ({}),
  LocalPreview: ({ file }: { file: File }) => <p>Preview: {file.name}</p>,
}));
const alice = { id: 2, email: "alice@example.invalid", profile: null };
const bob = { id: 3, email: "bob@example.invalid", profile: null };
const chat: ChatDetails = {
  id: 7,
  isGroup: true,
  name: "Team",
  createdAt: "2026-11-04",
  participants: [
    {
      id: 1,
      userId: 1,
      chatId: 7,
      role: "OWNER",
      user: { id: 1, email: "me@example.invalid", profile: null },
    },
    { id: 2, userId: 2, chatId: 7, role: "MEMBER", user: alice },
  ],
};
function setup(component: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter>
        <Routes>
          <Route path="*" element={component} />
          <Route
            path="/dashboard/websocket/7"
            element={<p>Conversation opened</p>}
          />
          <Route path="/dashboard" element={<p>Chat list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function select(search: string, email: string) {
  fireEvent.change(screen.getByLabelText("Search contacts by email"), {
    target: { value: search },
  });
  const result = await screen.findByRole("checkbox", {
    name: new RegExp(email.replaceAll(".", "\\.")),
  });
  fireEvent.click(result);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.userId = 1;
  mocks.search.mockImplementation(async (search: string) =>
    search.includes("alice") ? [alice] : [bob],
  );
  mocks.create.mockResolvedValue({ id: 7 });
  mocks.add.mockResolvedValue(chat);
  mocks.upload.mockResolvedValue({ ...chat, avatarId: "group-photo" });
  mocks.remove.mockResolvedValue(null);
  mocks.transfer.mockResolvedValue(chat);
});
describe("group conversation UX", () => {
  it("keeps people selected across searches, reviews the name and retries failed creation without losing inputs", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Connection lost"));
    setup(<NewChatDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "New group" }));
    await select("alice", alice.email);
    await select("bob", bob.email);
    const selections = screen.getByLabelText("Selected contacts");
    expect(within(selections).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Next · 2 selected" }));
    expect(screen.getByText("3 members, including you")).toBeTruthy();
    const name = screen.getByLabelText("Group name");
    expect(
      (
        screen.getByRole("button", {
          name: "Create group",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(name, { target: { value: "  Product team  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Connection lost",
    );
    expect((name as HTMLInputElement).value).toBe("  Product team  ");
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    await screen.findByText("Conversation opened");
    expect(mocks.create).toHaveBeenLastCalledWith([2, 3], "", {
      name: "Product team",
    });
  });
  it("uses an empty initial message for direct conversations", async () => {
    setup(<NewChatDialog open onOpenChange={vi.fn()} />);
    await select("alice", alice.email);
    fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
    await screen.findByText("Conversation opened");
    expect(mocks.create).toHaveBeenCalledWith([2], "", undefined);
  });
  it("adds a new person to an existing group and excludes current members", async () => {
    setup(<GroupInfoDialog chat={chat} />);
    fireEvent.click(screen.getByRole("button", { name: "Group info" }));
    fireEvent.click(screen.getByRole("button", { name: "Add members" }));
    await select("bob", bob.email);
    fireEvent.click(screen.getByRole("button", { name: "Add 1 members" }));
    await waitFor(() => expect(mocks.add).toHaveBeenCalledWith(7, [3]));
  });
  it("previews and confirms group photo uploads, preserving the selection after failure", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"));
    setup(<GroupInfoDialog chat={chat} />);
    fireEvent.click(screen.getByRole("button", { name: "Group info" }));
    fireEvent.change(screen.getByLabelText("Choose group photo"), {
      target: {
        files: [new File(["image"], "team.png", { type: "image/png" })],
      },
    });
    expect(screen.getByText("Preview: team.png")).toBeTruthy();
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
    await screen.findByText("Upload failed");
    expect(screen.getByText("Preview: team.png")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
    await waitFor(() =>
      expect(screen.queryByText("Preview: team.png")).toBeNull(),
    );
    expect(mocks.upload.mock.calls[1][0]).toBe("files/groups/7/avatar");
  });
  it("rejects invalid group photo files before upload", async () => {
    setup(<GroupInfoDialog chat={chat} />);
    fireEvent.click(screen.getByRole("button", { name: "Group info" }));
    fireEvent.change(screen.getByLabelText("Choose group photo"), {
      target: {
        files: [new File(["video"], "team.mp4", { type: "video/mp4" })],
      },
    });
    await screen.findByText("Choose a JPEG, PNG or WebP image.");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation before removing a member", async () => {
    setup(<GroupInfoDialog chat={chat} />);
    fireEvent.click(screen.getByRole("button", { name: "Group info" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(7, 2));
  });
  it("shows members only the actions they can use and confirms leaving", async () => {
    mocks.userId = 2;
    setup(<GroupInfoDialog chat={chat} />);
    fireEvent.click(screen.getByRole("button", { name: "Group info" }));
    expect(screen.queryByRole("button", { name: "Add members" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByLabelText("Choose group photo")).toBeNull();
    expect(screen.queryByLabelText("Group name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Leave group",
      }),
    );
    await screen.findByText("Chat list");
    expect(mocks.remove).toHaveBeenCalledWith(7, 2);
  });
});
