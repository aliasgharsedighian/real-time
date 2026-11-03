import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSessionStore } from "@/features/auth/session-store";
import ChatPage from "./ChatPage";
const mocks = vi.hoisted(() => ({ send: vi.fn(), upload: vi.fn() }));
vi.mock("@/features/auth/session-context", () => ({
  useSession: () => ({
    user: { id: 1, email: "sender@test.invalid", profile: null },
  }),
}));
vi.mock("./api", () => ({
  chatKeys: { history: () => ["history"] },
  getHistory: async () => ({ messages: [], users: [], unreadIds: [] }),
}));
vi.mock("./hooks/use-chat-room", () => ({
  useChatRoom: () => ({
    connected: true,
    typing: [],
    send: mocks.send,
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
  }),
}));
vi.mock("@/features/uploads/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useUploadPolicy: () => ({
    data: {
      avatarMaxBytes: 5e6,
      imageMaxBytes: 10e6,
      videoMaxBytes: 100e6,
      videoMaxSeconds: 300,
      imageMimeTypes: ["image/jpeg"],
      videoMimeTypes: ["video/mp4"],
    },
  }),
  uploadFile: mocks.upload,
}));
vi.mock("@/features/uploads/Media", () => ({
  LocalPreview: ({ file }: { file: File }) => <p>Preview: {file.name}</p>,
  Media: () => <p>Sent attachment</p>,
}));
function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/dashboard/websocket/3"]}>
        <Routes>
          <Route path="/dashboard/websocket/:chatId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function select(type = "video/mp4") {
  const picker = await screen.findByLabelText("Choose chat photo or video");
  fireEvent.change(picker, {
    target: { files: [new File(["media"], "clip.mp4", { type })] },
  });
}
describe("chat attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useSessionStore
      .getState()
      .setTokens({ accessToken: "access", refreshToken: "refresh" });
    mocks.upload.mockResolvedValue({ id: "attachment-id", kind: "VIDEO" });
    mocks.send.mockResolvedValue(undefined);
  });
  it("uploads a video and sends an attachment without requiring a caption", async () => {
    setup();
    await select();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("", "attachment-id"),
    );
    expect(mocks.upload.mock.calls[0][0]).toBe("files/chats/3");
    await waitFor(() =>
      expect(screen.queryByText("Preview: clip.mp4")).toBeNull(),
    );
  });
  it("preserves the selected file and caption after upload failure so the user can retry", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Upload failed"));
    setup();
    await select();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "caption" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Upload failed",
    );
    expect(screen.getByText("Preview: clip.mp4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("caption", "attachment-id"),
    );
  });
  it("reuses the uploaded ID if delivery fails, preventing a second upload on retry", async () => {
    mocks.send.mockRejectedValueOnce(new Error("No confirmation"));
    setup();
    await select();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("No confirmation");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenLastCalledWith("", "attachment-id");
  });
  it("rejects an unsupported file before uploading", async () => {
    setup();
    await select("image/svg+xml");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Choose a JPEG",
    );
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: "Send message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
