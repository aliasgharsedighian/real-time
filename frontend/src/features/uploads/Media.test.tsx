import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSessionStore } from "@/features/auth/session-store";
import { api } from "@/shared/lib/api";
import { Media } from "./Media";
import { MessageAttachmentList } from "@/features/chat/components/MessageAttachmentList";
import type { MediaFile } from "./api";

vi.mock("@/shared/lib/api", () => ({ api: { get: vi.fn() } }));

afterEach(() => {
  useSessionStore.getState().clear();
  vi.unstubAllGlobals();
});

it("loads a sent video on demand and releases its player when the full-screen viewer closes", async () => {
  const release = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:chat-video",
      revokeObjectURL: release,
    }),
  );
  useSessionStore
    .getState()
    .setTokens({ accessToken: "access", refreshToken: "refresh" });
  vi.mocked(api.get).mockResolvedValueOnce({
    data: new Blob([], { type: "video/mp4" }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Media
        file={{
          id: "video-id",
          kind: "VIDEO",
          mimeType: "video/mp4",
          size: 50,
          width: 720,
          height: 1280,
          duration: 65,
        }}
      />
    </QueryClientProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Open video" });
  expect(trigger.textContent).toContain("1:05");
  expect(api.get).not.toHaveBeenCalled();

  fireEvent.click(trigger);
  const viewer = screen.getByRole("dialog", { name: "Video" });
  const player = (await within(viewer).findByLabelText(
    "Chat video",
  )) as HTMLVideoElement;
  expect(player.controls).toBe(true);
  expect(player.playsInline).toBe(true);
  expect(api.get).toHaveBeenCalledWith(
    "files/video-id/content",
    expect.objectContaining({ responseType: "blob" }),
  );
  expect(
    within(viewer)
      .getByRole("link", { name: "Download video" })
      .getAttribute("href"),
  ).toBe("blob:chat-video");

  fireEvent.click(within(viewer).getByRole("button", { name: "Close video" }));
  expect(screen.queryByLabelText("Chat video")).toBeNull();
  expect(release).toHaveBeenCalledWith("blob:chat-video");
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("fetches a document only on click and reports progress in the file button", async () => {
  vi.mocked(api.get).mockClear();
  vi.mocked(api.get).mockImplementationOnce(async (_path, config) => {
    config?.onDownloadProgress?.({ loaded: 45, total: 100, bytes: 45, lengthComputable: true });
    return new Promise(() => {});
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Media file={{
        id: "file-id",
        kind: "DOCUMENT",
        title: "Book1.xlsx",
        mimeType: "application/octet-stream",
        size: 11264,
        width: 0,
        height: 0,
      }} />
    </QueryClientProvider>,
  );
  const button = screen.getByRole("button", { name: "Download Book1.xlsx" });
  expect(screen.getByText("11.0 KB")).toBeTruthy();
  expect(api.get).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(button));
  expect(await within(button).findByText("45%")).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it("opens a 1000-attachment list without fetching contents and requests only the selected track", async () => {
  vi.mocked(api.get).mockClear();
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(() => {}));
  useSessionStore.getState().setTokens({ accessToken: "access", refreshToken: "refresh" });
  const files = Array.from({ length: 1000 }, (_, index): MediaFile => ({
    id: String(index),
    kind: index % 2 ? "DOCUMENT" : "MUSIC",
    title: `Attachment ${index}`,
    mimeType: index % 2 ? "application/octet-stream" : "audio/mp4",
    size: 100,
    width: 0,
    height: 0,
  }));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MessageAttachmentList files={files}>
        {(file) => <Media key={file.id} file={file} />}
      </MessageAttachmentList>
    </QueryClientProvider>,
  );
  expect(screen.getAllByRole("button")).toHaveLength(21);
  fireEvent.click(screen.getByRole("button", { name: /Show 20 more attachments/ }));
  expect(screen.getAllByRole("button")).toHaveLength(41);
  expect(api.get).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Attachment 20" }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  expect(api.get).toHaveBeenCalledWith("files/20/content", expect.objectContaining({
    responseType: "blob",
  }));
});
