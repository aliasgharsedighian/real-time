import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ConversationActions } from "./ChatActions";
import { muteChat } from "../api";
vi.mock("../api", () => ({ muteChat: vi.fn(), deleteChat: vi.fn() }));
function mount(isGroup = false, myRole: "MEMBER" | "OWNER" = "MEMBER") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ConversationActions
          chat={{
            id: 1,
            isGroup,
            myRole,
            createdAt: "2026-11-05T00:00:00Z",
            participants: [],
            messages: [],
          }}
        >
          <a href="/dashboard/websocket/1">Conversation</a>
        </ConversationActions>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function touch(element: HTMLElement, type: string, x: number, y = 100) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerType: "touch", clientX: x, clientY: y });
  fireEvent(element, event);
}
describe("conversation actions", () => {
  it("reveals mute and delete after a left swipe and suppresses navigation", async () => {
    vi.mocked(muteChat).mockResolvedValue(undefined);
    mount();
    const link = screen.getByText("Conversation");
    touch(link, "pointerdown", 200);
    touch(link, "pointerup", 100);
    expect(link.parentElement?.style.transform).toBe("translateX(-144px)");
    expect(fireEvent.click(link)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(muteChat).toHaveBeenCalledWith(1, true));
  });
  it("shows permanent deletion for direct chats on right click", () => {
    mount();
    fireEvent.contextMenu(screen.getByText("Conversation"));
    expect(screen.getByRole("menuitem", { name: "Delete chat" })).toBeTruthy();
  });
  it("hides group deletion from members", () => {
    mount(true);
    fireEvent.contextMenu(screen.getByText("Conversation"));
    expect(screen.queryByRole("menuitem", { name: "Delete group" })).toBeNull();
  });
  it("lets a group owner open the delete confirmation", () => {
    mount(true, "OWNER");
    fireEvent.contextMenu(screen.getByText("Conversation"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete group" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
