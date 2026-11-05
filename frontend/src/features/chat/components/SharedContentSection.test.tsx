import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { SharedContentSection } from "./SharedContentSection";
import { getSharedContent } from "../api";
vi.mock("../api", () => ({ getSharedContent: vi.fn() }));
vi.mock("@/features/uploads/Media", () => ({
  Media: () => <p>Shared photo preview</p>,
}));
const counts = { IMAGE: 1, VIDEO: 0, AUDIO: 0, LINK: 21 };
it("shows real category counts and pages shared links beyond the first result set", async () => {
  vi.mocked(getSharedContent).mockImplementation(async (_id, kind, before) => ({
    counts,
    messages:
      kind === "LINK"
        ? [
            {
              id: before ? 1 : 2,
              chatId: 7,
              senderId: 3,
              content: before
                ? "https://example.invalid/older"
                : "https://example.invalid/newer",
              createdAt: "2026-11-05T00:00:00Z",
            },
          ]
        : [],
    nextCursor: kind === "LINK" && !before ? 2 : null,
  }));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SharedContentSection chatId={7} />
    </QueryClientProvider>,
  );
  const links = await screen.findByRole("button", { name: "Link messages 21" });
  expect(screen.getByRole("button", { name: "Photos 1" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /GIF/ })).toBeNull();
  fireEvent.click(links);
  expect(
    (
      await screen.findByRole("link", { name: "https://example.invalid/newer" })
    ).getAttribute("href"),
  ).toBe("https://example.invalid/newer");
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByRole("link", { name: "https://example.invalid/older" });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Shared content" }));
  await screen.findByRole("button", { name: "Photos 1" });
});
