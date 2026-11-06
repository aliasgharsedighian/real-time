import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
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
