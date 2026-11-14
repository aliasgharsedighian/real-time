import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSessionStore } from "@/features/auth/session-store";
import ChatPage from "./ChatPage";
import { formatMessageDay, formatMessageTime } from "@/shared/lib/date";
import {
  MessageSearchProvider,
  useMessageSearch,
} from "./message-search-context";
const mocks = vi.hoisted(() => ({
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
  send: vi.fn(),
  upload: vi.fn(),
  discard: vi.fn(),
  history: vi.fn(),
  search: vi.fn(),
  window: vi.fn(),
  days: vi.fn(),
  sync: vi.fn(),
  edit: vi.fn(),
  delete: vi.fn(),
  forward: vi.fn(),
  chats: vi.fn(),
  profile: vi.fn(),
  reaction: vi.fn(),
  pins: vi.fn(),
  setPin: vi.fn(),
}));
vi.mock("@/features/auth/session-context", () => ({
  useSession: () => ({
    user: { id: 1, email: "sender@test.invalid", profile: null },
  }),
}));
vi.mock("./api", () => ({
  chatKeys: {
    history: (_: unknown, chatId: number) => ["history", chatId],
    list: () => ["chats"],
    pins: (_: unknown, chatId: number) => ["pinned-messages", chatId],
    readers: (_: unknown, chatId: number, id: number) => [
      "message-readers",
      chatId,
      id,
    ],
  },
  getMessageReaders: async () => [],
  setMessageReaction: (...args: unknown[]) => mocks.reaction(...args),
  getPinnedMessages: (...args: unknown[]) => mocks.pins(...args),
  setMessagePin: (...args: unknown[]) => mocks.setPin(...args),
  getHistory: (...args: unknown[]) => mocks.history(...args),
  syncMessages: (...args: unknown[]) => mocks.sync(...args),
  editMessage: (...args: unknown[]) => mocks.edit(...args),
  deleteMessages: (...args: unknown[]) => mocks.delete(...args),
  forwardMessages: (...args: unknown[]) => mocks.forward(...args),
  getChats: (...args: unknown[]) => mocks.chats(...args),
  getUserProfile: (...args: unknown[]) => mocks.profile(...args),
  searchMessages: (...args: unknown[]) => mocks.search(...args),
  getMessageWindow: (...args: unknown[]) => mocks.window(...args),
  getMessageDays: (...args: unknown[]) => mocks.days(...args),
}));
vi.mock("./hooks/use-chat-room", () => ({
  useChatRoom: () => ({
    connected: true,
    typing: [],
    send: mocks.send,
    startTyping: mocks.startTyping,
    stopTyping: mocks.stopTyping,
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
      audioMaxSeconds: 300,
      audioMaxBytes: 20e6,
      audioMimeTypes: ["audio/webm"],
      documentExtensions: [".zip"],
      documentMaxBytes: 100 * 1024 * 1024,
      imageMimeTypes: ["image/jpeg"],
      videoMimeTypes: ["video/mp4"],
    },
  }),
  uploadFile: mocks.upload,
  discardFile: mocks.discard,
}));
vi.mock("@/features/uploads/Media", () => ({
  useFileUrl: (id?: string) => ({ url: id ? `blob:${id}` : undefined }),
  LocalPreview: ({ file }: { file: File }) => <p>Preview: {file.name}</p>,
  Media: () => <p>Sent attachment</p>,
}));
vi.mock("./components/ChatEmojiPicker", () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button onClick={() => onSelect("😀")}>Pick smile</button>
  ),
}));
function SearchOpener() {
  const search = useMessageSearch();
  return (
    <button onClick={() => search.setOpen(true)}>Open search panel</button>
  );
}
function setup(
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/dashboard/websocket/3"]}>
        <Routes>
          <Route
            path="/dashboard/websocket/:chatId"
            element={
              <MessageSearchProvider>
                <SearchOpener />
                <ChatPage />
              </MessageSearchProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function select(type = "video/mp4") {
  const picker = await screen.findByLabelText(
    "Choose chat photo or video",
  );
  fireEvent.change(picker, {
    target: { files: [new File(["media"], "clip.mp4", { type })] },
  });
}
describe("chat attachments", () => {
  it("separates local calendar days, shows only message times, and jumps to an unloaded date", async () => {
    const message = (id: number, content: string, date: Date) => ({
      id,
      chatId: 3,
      senderId: 2,
      content,
      createdAt: date.toISOString(),
    });
    const before = message(
      99,
      "Before midnight",
      new Date(2026, 10, 3, 23, 59),
    );
    const after = message(100, "After midnight", new Date(2026, 10, 4, 0, 1));
    mocks.history.mockResolvedValue({
      messages: [before, after],
      users: [],
      unreadIds: [],
      nextPage: null,
    });
    mocks.days.mockResolvedValue({
      days: [{ date: "2026-11-01", messageId: 30 }],
    });
    mocks.window.mockResolvedValue({
      messages: [
        message(30, "First message of November", new Date(2026, 10, 1, 9, 0)),
      ],
      beforeId: null,
      afterId: 30,
    });
    setup();
    await screen.findByText("After midnight");
    expect(
      screen.getByRole("separator", { name: formatMessageDay("2026-11-03") }),
    ).toBeTruthy();
    expect(
      screen.getByRole("separator", { name: formatMessageDay("2026-11-04") }),
    ).toBeTruthy();
    const time = document.querySelector('[data-message-id="99"] time');
    expect(time?.textContent).toBe(formatMessageTime(before.createdAt));
    fireEvent.scroll(screen.getByRole("log"), { target: { scrollTop: 100 } });
    fireEvent.click(screen.getByRole("button", { name: /Jump to date/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: formatMessageDay("2026-11-01"),
      }),
    );
    await screen.findByText("First message of November");
    expect(mocks.window.mock.calls[0][1]).toEqual({ aroundId: 30 });
    expect(screen.queryByText("After midnight")).toBeNull();
  });
  it.each([false, true])(
    "opens an old server search result in a %s group chat and returns to latest messages",
    async (isGroup) => {
      const message = (id: number, content: string) => ({
        id,
        chatId: 3,
        senderId: 2,
        content,
        createdAt: "2026-11-04T10:00:00Z",
      });
      const users = [
        {
          userId: 2,
          user: { id: 2, email: "alice@test.invalid", profile: null },
        },
      ];
      mocks.history.mockResolvedValue({
        messages: [message(100, "Latest message")],
        users,
        unreadIds: [],
        nextPage: null,
        chat: { id: 3, isGroup, name: "Search group", participants: users },
      });
      mocks.search.mockResolvedValue({
        messages: [
          { ...message(30, "needle from last month"), sender: users[0].user },
        ],
        nextCursor: null,
      });
      mocks.window.mockResolvedValue({
        messages: [
          message(30, "needle from last month"),
          message(31, "Next to the old message"),
        ],
        beforeId: 30,
        afterId: 31,
      });
      setup();
      await screen.findByText("Latest message");
      fireEvent.click(
        screen.getByRole("button", { name: "Open search panel" }),
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Search message text" }),
        { target: { value: "needle" } },
      );
      const excerpt = await screen.findByText("needle", { selector: "mark" });
      fireEvent.click(excerpt.closest("button")!);
      await screen.findByText("Next to the old message");
      await waitFor(() =>
        expect(
          document.querySelector('[data-message-id="30"]')?.className,
        ).not.toContain("ring-2"),
      );
      expect(screen.queryByText("Latest message")).toBeNull();
      expect(mocks.window.mock.calls[0][1]).toEqual({ aroundId: 30 });
      fireEvent.click(
        screen.getByRole("button", { name: "Go to latest messages" }),
      );
      await screen.findByText("Latest message");
      expect(document.querySelector('[data-message-id="30"]')).toBeNull();
    },
  );
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.history.mockResolvedValue({ messages: [], users: [], unreadIds: [] });
    mocks.pins.mockReset().mockResolvedValue([]);
    sessionStorage.clear();
    useSessionStore
      .getState()
      .setTokens({ accessToken: "access", refreshToken: "refresh" });
    mocks.upload.mockResolvedValue({ id: "attachment-id", kind: "VIDEO" });
    mocks.discard.mockResolvedValue(undefined);
    mocks.send.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("opens the original chat at an older saved source after confirming access", async () => {
    const original = {
      id: 19,
      chatId: 7,
      senderId: 2,
      content: "Original message",
      createdAt: new Date().toISOString(),
    };
    mocks.history.mockImplementation(async (chatId: number) => ({
      chat: {
        id: chatId,
        isGroup: false,
        savedOwnerId: chatId === 3 ? 1 : null,
      },
      messages:
        chatId === 3
          ? [
              {
                ...original,
                id: 81,
                chatId: 3,
                senderId: 1,
                content: "Saved copy",
                forwarded: true,
                forwardedFrom: { id: 2, email: "author@example.test" },
                savedFrom: { id: 19, chatId: 7 },
              },
            ]
          : [],
      users: [],
      unreadIds: [],
    }));
    mocks.window.mockRejectedValueOnce(new Error("Message unavailable"));
    mocks.window.mockResolvedValue({
      messages: [original],
      beforeId: null,
      afterId: null,
    });
    setup();
    await screen.findByText("Forwarded from author@example.test");
    const jump = screen.getByRole("button", { name: "Go to original message" });
    fireEvent.click(jump);
    await waitFor(() => expect(mocks.window).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Saved copy")).toBeTruthy();
    expect(mocks.history).not.toHaveBeenCalledWith(7, expect.anything());

    fireEvent.click(jump);
    await screen.findByText("Original message");
    await waitFor(() =>
      expect(
        document.querySelector('[data-message-id="19"]')?.className,
      ).toContain("outline-primary"),
    );
    expect(mocks.window).toHaveBeenCalledWith(
      7,
      { aroundId: 19 },
      expect.any(AbortSignal),
    );
  });
  it("prefetches at the tenth oldest row, shows the existing compact loader and stops at the end", async () => {
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(500);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(5000);
    let intersect!: (entries: { isIntersecting: boolean }[]) => void;
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe = observe;
        disconnect = vi.fn();
      },
    );
    const messages = Array.from({ length: 50 }, (_, index) => ({
      id: index + 51,
      chatId: 3,
      senderId: 2,
      content: `Message ${index + 51}`,
      createdAt: "2026-11-04T10:00:00Z",
    }));
    let finish!: (value: unknown) => void;
    mocks.history
      .mockResolvedValueOnce({
        messages,
        users: [],
        unreadIds: [],
        nextPage: 2,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    setup();
    await screen.findByText("Message 100");
    await waitFor(() => expect(observe).toHaveBeenCalled());
    expect(observe.mock.calls[0][0].dataset.messageId).toBe("60");
    act(() => intersect([{ isIntersecting: true }]));
    expect(mocks.history).toHaveBeenCalledTimes(1);
    fireEvent.scroll(screen.getByRole("log"), { target: { scrollTop: 300 } });
    act(() => intersect([{ isIntersecting: true }]));
    await screen.findByText("Loading earlier messages…");
    expect(mocks.history.mock.calls[1][2]).toBe(2);
    await act(async () =>
      finish({ messages: [], users: [], unreadIds: [], nextPage: null }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading earlier messages…")).toBeNull(),
    );
    expect(
      screen.queryByRole("button", { name: "Load earlier messages" }),
    ).toBeNull();
    expect(screen.getByText("Message 100")).toBeTruthy();
  });
  it("renders membership changes as group activity instead of sender bubbles", async () => {
    mocks.history.mockResolvedValue({
      users: [],
      unreadIds: [],
      messages: [
        {
          id: 10,
          chatId: 3,
          senderId: 2,
          kind: "MEMBER_LEFT",
          content: "Alice left the group.",
          createdAt: "2026-11-04T10:00:00.000Z",
        },
        {
          id: 11,
          chatId: 3,
          senderId: 1,
          kind: "MEMBER_REMOVED",
          content: "Owner removed Bob from the group.",
          createdAt: "2026-11-04T10:01:00.000Z",
        },
        {
          id: 12,
          chatId: 3,
          senderId: 1,
          kind: "MEMBER_ADDED",
          content: "Charlie was added to the group.",
          createdAt: "2026-11-04T10:02:00.000Z",
        },
      ],
    });
    setup();
    await screen.findByText("Alice left the group.");
    expect(screen.getByText("Owner removed Bob from the group.")).toBeTruthy();
    expect(screen.getByText("Charlie was added to the group.")).toBeTruthy();
    expect(screen.getAllByLabelText("Group activity")).toHaveLength(3);
    expect(screen.queryByLabelText("Sent")).toBeNull();
  });
  it("shows the historical group photo and opens its reaction picker", async () => {
    mocks.history.mockResolvedValue({
      users: [],
      unreadIds: [],
      messages: [
        {
          id: 15,
          chatId: 3,
          senderId: 2,
          kind: "GROUP_PHOTO_CHANGED",
          content: "Alice changed the group photo.",
          createdAt: "2026-11-13T10:00:00Z",
          attachments: [{ id: "historical-photo", kind: "IMAGE" }],
        },
        {
          id: 16,
          chatId: 3,
          senderId: 2,
          kind: "GROUP_PHOTO_REMOVED",
          content: "Alice removed the group photo.",
          createdAt: "2026-11-13T10:01:00Z",
        },
      ],
    });
    mocks.reaction.mockResolvedValue({
      messageId: 15,
      chatId: 3,
      reactionVersion: 1,
      reactions: [],
    });
    setup();
    const photo = await screen.findByRole("img", {
      name: "Updated group photo",
    });
    expect(photo.getAttribute("src")).toBe("blob:historical-photo");
    expect(screen.getByText("Alice removed the group photo.")).toBeTruthy();
    fireEvent.contextMenu(photo);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Like" }));
    await waitFor(() =>
      expect(mocks.reaction).toHaveBeenCalledWith(3, 15, "👍"),
    );
  });
  it("focuses the composer when history finishes loading, without refocusing on draft updates", async () => {
    let finish!: (value: unknown) => void;
    mocks.history.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    setup();
    expect(screen.queryByLabelText("Message")).toBeNull();
    await act(async () => finish({ messages: [], users: [], unreadIds: [] }));
    const input = await screen.findByLabelText("Message");
    expect(document.activeElement).toBe(input);
    const other = screen.getByRole("button", { name: "Open search panel" });
    other.focus();
    fireEvent.change(input, { target: { value: "draft update" } });
    expect(document.activeElement).toBe(other);
  });
  it.each(["Reply", "Edit"])(
    "keeps composer focus after choosing %s from the message menu",
    async (action) => {
      mocks.history.mockResolvedValue({
        messages: [
          {
            id: 91,
            chatId: 3,
            senderId: 1,
            content: "Original text",
            createdAt: "2026-11-05T08:00:00Z",
          },
        ],
        users: [],
        unreadIds: [],
      });
      setup();
      const input = await screen.findByLabelText("Message");
      const trigger = screen.getByRole("button", {
        name: "Message actions 91",
      });
      trigger.focus();
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("menuitem", { name: action }));
      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(input);
    },
  );
  it("keeps mobile Enter for newlines and preserves composer focus while sending", async () => {
    const originalMatchMedia = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...originalMatchMedia(query),
      matches: query === "(pointer: coarse)",
    }));
    let finish!: () => void;
    mocks.send.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    setup();
    const input = (await screen.findByLabelText(
      "Message",
    )) as HTMLTextAreaElement;
    input.focus();
    fireEvent.change(input, { target: { value: "hello" } });
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(input.getAttribute("aria-busy")).toBe("true");
    expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "next draft" } });
    await act(async () => finish());
    expect(input.value).toBe("next draft");
    expect(input.readOnly).toBe(false);
    expect(document.activeElement).toBe(input);
  });
  it("keeps typing for a nonempty input even after blur and stops when cleared", async () => {
    setup();
    const input = await screen.findByLabelText("Message");
    mocks.stopTyping.mockClear();
    fireEvent.change(input, { target: { value: "hello" } });
    await waitFor(() => expect(mocks.startTyping).toHaveBeenCalled());
    fireEvent.blur(input);
    expect(mocks.stopTyping).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "hello again" } });
    expect(mocks.stopTyping).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(mocks.stopTyping).toHaveBeenCalled());
  });
  it("publishes typing for restored drafts and clears it after sending", async () => {
    sessionStorage.setItem("beam-draft:1:3", "restored draft");
    setup();
    await screen.findByRole("button", { name: "Send message" });
    await waitFor(() => expect(mocks.startTyping).toHaveBeenCalled());
    mocks.stopTyping.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(mocks.stopTyping).toHaveBeenCalled());
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("");
  });
  it("switches between microphone and send as text is entered and cleared", async () => {
    setup();
    await screen.findByRole("button", { name: "Hold to record voice message" });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "hello" },
    });
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "" },
    });
    expect(
      screen.getByRole("button", { name: "Hold to record voice message" }),
    ).toBeTruthy();
  });
  it("inserts the selected emoji into the message", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose emoji" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Pick smile" }));
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("😀");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("previews a held recording on release and uploads only after confirmation", async () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop }] }),
      },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable?: (event: { data: Blob }) => void;
        onstop?: () => void;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"]) });
          this.onstop?.();
        }
      },
    );
    setup();
    const mic = await screen.findByRole("button", {
      name: "Hold to record voice message",
    });
    fireEvent.pointerDown(mic, { button: 0, pointerId: 1 });
    await screen.findByText(/Recording 0:00/);
    fireEvent.pointerUp(mic, { pointerId: 1 });
    await screen.findByText(/Listen to your voice message/);
    expect(stop).toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("", "attachment-id"),
    );
    expect(mocks.upload.mock.calls[0][0]).toBe("files/chats/3");
    expect(mocks.upload.mock.calls[0][1].type).toBe("audio/webm");
  });
  it("offers three attachment options and sends a document through its own upload route", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Attach to message" }));
    const menu = screen.getByRole("dialog", { name: "Attachments" });
    expect(within(menu).getAllByRole("button").map((button) => button.textContent))
      .toEqual(["Photo or video", "Document", "Music"]);

    const picker = screen.getByLabelText("Choose chat document");
    const openPicker = vi.spyOn(picker, "click");
    fireEvent.click(within(menu).getByRole("button", { name: "Document" }));
    expect(openPicker).toHaveBeenCalledOnce();

    const file = new File(["archive"], "project.ZIP");
    fireEvent.change(picker, { target: { files: [file] } });
    expect(await screen.findByText("project.ZIP")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("", "attachment-id"));
    expect(mocks.upload.mock.calls[0].slice(0, 2)).toEqual(["files/chats/3/document", file]);
  });
  it("sends an audio file selected from the attachment picker as music", async () => {
    setup();
    const picker = await screen.findByLabelText("Choose chat music");
    const music = new File(["track"], "song.webm", { type: "audio/webm" });
    fireEvent.change(picker, { target: { files: [music] } });
    await screen.findByText(/Music · up to/);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith("", "attachment-id"));
    expect(mocks.upload.mock.calls[0].slice(0, 2)).toEqual(["files/chats/3/music", music]);
  });
  it("previews, adds and removes photos before sending an ordered album with one caption", async () => {
    mocks.upload
      .mockResolvedValueOnce({ id: "first", kind: "IMAGE" })
      .mockResolvedValueOnce({ id: "third", kind: "IMAGE" });
    setup();
    const picker = await screen.findByLabelText(
      "Choose chat photo or video",
    );
    const photo = (name: string) =>
      new File(["image"], name, { type: "image/jpeg" });
    fireEvent.change(picker, {
      target: { files: [photo("one.jpg"), photo("two.jpg")] },
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2 photos selected")).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove photo 2: two.jpg" }),
    );
    fireEvent.change(within(dialog).getByLabelText("Choose more photos"), {
      target: { files: [photo("three.jpg")] },
    });
    fireEvent.change(within(dialog).getByLabelText("Caption"), {
      target: { value: "Album caption" },
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        "Album caption",
        ["first", "third"],
        undefined,
      ),
    );
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls.map(([, file]) => file.name)).toEqual([
      "one.jpg",
      "three.jpg",
    ]);
  });

  it("keeps the album visible and continues after cancelling an uploaded, active or queued photo", async () => {
    let activeSignal!: AbortSignal;
    let finishLast!: () => void;
    mocks.upload
      .mockResolvedValueOnce({ id: "first", kind: "IMAGE" })
      .mockImplementationOnce((_path, _file, signal: AbortSignal, progress) => {
        activeSignal = signal;
        progress(50);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      })
      .mockResolvedValueOnce({ id: "fourth", kind: "IMAGE" })
      .mockImplementationOnce((_path, _file, _signal, progress) => {
        progress(100);
        return new Promise((resolve) => {
          finishLast = () => resolve({ id: "fifth", kind: "IMAGE" });
        });
      });
    setup();
    const picker = await screen.findByLabelText(
      "Choose chat photo or video",
    );
    const names = ["one", "two", "three", "four", "five"];
    fireEvent.change(picker, {
      target: {
        files: names.map(
          (name) => new File(["image"], `${name}.jpg`, { type: "image/jpeg" }),
        ),
      },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Send" }),
    );
    const active = await screen.findByRole("progressbar", {
      name: "Upload progress: two.jpg",
    });
    expect(active.getAttribute("aria-valuenow")).toBe("50");
    const pending = within(screen.getByLabelText("Photo uploads"));
    for (const name of names)
      expect(pending.getByText(`Preview: ${name}.jpg`)).toBeTruthy();
    for (const name of ["one", "three", "two"]) {
      fireEvent.click(
        pending.getByRole("button", { name: `Cancel upload: ${name}.jpg` }),
      );
    }
    expect(activeSignal.aborted).toBe(true);
    expect(mocks.discard).toHaveBeenCalledWith("first");
    await pending.findByText("Processing…");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(pending.getByText("Preview: four.jpg")).toBeTruthy();
    expect(pending.getByText("Preview: five.jpg")).toBeTruthy();
    await act(async () => finishLast());
    expect(mocks.upload.mock.calls.map(([, file]) => file.name)).toEqual([
      "one.jpg",
      "two.jpg",
      "four.jpg",
      "five.jpg",
    ]);
    expect(mocks.send.mock.calls).toEqual([
      ["", ["fourth", "fifth"], undefined],
    ]);
    expect(screen.queryByLabelText("Photo uploads")).toBeNull();
  });

  it("continues separate photo sends after a partial failure without resending a delivered photo", async () => {
    mocks.upload
      .mockResolvedValueOnce({ id: "one", kind: "IMAGE" })
      .mockResolvedValueOnce({ id: "two", kind: "IMAGE" });
    mocks.send
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Try sending again"));
    setup();
    const picker = await screen.findByLabelText(
      "Choose chat photo or video",
    );
    fireEvent.change(picker, {
      target: {
        files: ["one", "two"].map(
          (name) => new File(["image"], `${name}.jpg`, { type: "image/jpeg" }),
        ),
      },
    });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "Group photos in one message",
      }),
    );
    fireEvent.change(within(dialog).getByLabelText("Caption"), {
      target: { value: "First photo caption" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    await screen.findByText("Try sending again");
    expect(screen.getByText("1 photo selected")).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Send" }),
    );
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(3));
    expect(mocks.send.mock.calls).toEqual([
      ["First photo caption", "one", undefined],
      ["", "two", undefined],
      ["", "two", undefined],
    ]);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
  });

  it("cancels an active photo upload from the pending message and restores the selection", async () => {
    mocks.upload.mockImplementationOnce(
      (_path, _file, signal: AbortSignal, progress) =>
        new Promise((_resolve, reject) => {
          progress(35);
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    setup();
    const picker = await screen.findByLabelText(
      "Choose chat photo or video",
    );
    fireEvent.change(picker, {
      target: {
        files: [new File(["image"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Send" }),
    );
    expect(await screen.findByText("35%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    await screen.findByText("1 photo selected");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("opens a single photo and opens an album at the selected photo with navigation and download", async () => {
    const photo = (id: string) => ({
      id,
      kind: "IMAGE",
      mimeType: "image/webp",
      width: 120,
      height: 250,
      size: 100,
    });
    const message = (id: number, attachments: ReturnType<typeof photo>[]) => ({
      id,
      attachments,
      chatId: 3,
      senderId: 2,
      content: "Caption",
      createdAt: "2026-11-05T08:00:00Z",
    });
    mocks.history.mockResolvedValue({
      messages: [
        message(91, [photo("single")]),
        message(92, [photo("first"), photo("second")]),
      ],
      users: [],
      unreadIds: [],
    });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Open photo" }));
    let gallery = screen.getByRole("dialog");
    expect(
      within(gallery)
        .getByRole("link", { name: "Download photo" })
        .getAttribute("href"),
    ).toBe("blob:single");
    fireEvent.click(
      within(gallery).getByRole("button", { name: "Close gallery" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open photo 2" }));
    gallery = screen.getByRole("dialog");
    expect(within(gallery).getByText("Photo 2 of 2")).toBeTruthy();
    fireEvent.click(
      within(gallery).getByRole("button", { name: "Previous photo" }),
    );
    expect(
      within(gallery)
        .getByRole("link", { name: "Download photo" })
        .getAttribute("download"),
    ).toBe("batgram-first.webp");
    fireEvent.keyDown(gallery, { key: "ArrowRight" });
    expect(
      within(gallery)
        .getByRole("link", { name: "Download photo" })
        .getAttribute("href"),
    ).toBe("blob:second");
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
          name: "Hold to record voice message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("replies to any message, edits only own messages, restores drafts and displays edited beside the time", async () => {
    const incoming = {
      id: 1,
      chatId: 3,
      senderId: 2,
      content: "Incoming",
      createdAt: "2026-11-05T08:00:00Z",
      sender: { id: 2, email: "peer@test.invalid", profile: null },
    };
    const own = { ...incoming, id: 2, senderId: 1, content: "My text" };
    mocks.history.mockResolvedValue({
      messages: [incoming, own],
      users: [],
      unreadIds: [],
    });
    mocks.edit.mockResolvedValue({
      ...own,
      content: "Corrected",
      editedAt: "2026-11-05T09:00:00Z",
    });
    setup();
    await screen.findByText("Incoming");
    fireEvent.click(screen.getByRole("button", { name: "Message actions 1" }));
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Reply" }));
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("Answer", undefined, 1),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Unsent draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Message actions 2" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("My text");
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Corrected" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save edited message" }),
    );
    await screen.findByText("edited");
    expect(mocks.edit).toHaveBeenCalledWith(3, 2, "Corrected");
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("Unsent draft");
  });
  it("selects multiple own messages and deletes the selection with confirmation", async () => {
    mocks.history.mockResolvedValue({
      messages: [1, 2].map((id) => ({
        id,
        chatId: 3,
        senderId: 1,
        content: `Selected ${id}`,
        createdAt: "2026-11-05T08:00:00Z",
      })),
      users: [],
      unreadIds: [],
    });
    mocks.delete.mockResolvedValue(undefined);
    setup();
    await screen.findByText("Selected 1");
    fireEvent.click(screen.getByRole("button", { name: "Message actions 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Select message 2" }));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      [...dialog.querySelectorAll("button")].find(
        (button) => button.textContent === "Delete",
      )!,
    );
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith(3, [1, 2]));
    await waitFor(() => expect(screen.queryByText("Selected 1")).toBeNull());
    expect(screen.queryByText("Selected 2")).toBeNull();
  });

  it("forwards a multiple-message selection to a chosen conversation", async () => {
    mocks.history.mockResolvedValue({
      messages: [1, 2].map((id) => ({
        id,
        chatId: 3,
        senderId: 1,
        content: `Forward ${id}`,
        createdAt: "2026-11-05T08:00:00Z",
      })),
      users: [],
      unreadIds: [],
    });
    mocks.chats.mockResolvedValue([
      {
        id: 9,
        isGroup: true,
        name: "Destination",
        participants: [],
        messages: [],
        createdAt: "2026-11-05T08:00:00Z",
      },
    ]);
    mocks.forward.mockResolvedValue([]);
    setup();
    await screen.findByText("Forward 1");
    fireEvent.click(screen.getByRole("button", { name: "Message actions 1" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Select message 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    fireEvent.click(await screen.findByRole("button", { name: "Destination" }));
    await waitFor(() =>
      expect(mocks.forward).toHaveBeenCalledWith(3, [1, 2], 9),
    );
    await waitFor(() => expect(screen.queryByText("2 selected")).toBeNull());
  });
  it("shows a forwarded author's name and opens that author's profile", async () => {
    mocks.history.mockResolvedValue({
      messages: [
        {
          id: 15,
          chatId: 3,
          senderId: 1,
          content: "Forwarded message",
          createdAt: "2026-11-05T08:00:00Z",
          forwarded: true,
          forwardedFrom: { id: 8, email: "author@test.invalid", profile: null },
        },
      ],
      users: [],
      unreadIds: [],
    });
    mocks.chats.mockResolvedValue([]);
    mocks.profile.mockResolvedValue({
      id: 8,
      email: "author@test.invalid",
      phoneNumber: "+123456789",
      profile: {
        firstname: "Original",
        lastname: "Author",
        address: "Profile address",
      },
    });
    setup();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "View profile of author@test.invalid",
      }),
    );
    await screen.findByRole("heading", { name: "Original Author" });
    expect(mocks.profile).toHaveBeenCalledWith(8, expect.any(AbortSignal));
    expect(screen.getByText("+123456789")).toBeTruthy();
    expect(screen.getByText("Profile address")).toBeTruthy();
    expect(screen.queryByText("Username")).toBeNull();
  });
  it("opens reply preview by swiping left and preserves the draft until it is sent", async () => {
    const text =
      "A long original message\nwith several lines\nand more content to preview";
    mocks.history.mockResolvedValue({
      messages: [
        {
          id: 77,
          chatId: 3,
          senderId: 2,
          content: text,
          createdAt: "2026-11-05T08:00:00Z",
          sender: { id: 2, email: "peer@test.invalid", profile: null },
        },
      ],
      users: [],
      unreadIds: [],
    });
    setup();
    const message = await screen.findByText(text, {
      normalizer: (value) => value,
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "My draft reply" },
    });
    screen.getByLabelText("Message").blur();
    for (const [type, x] of [
      ["pointerdown", 100],
      ["pointermove", 20],
      ["pointerup", 20],
    ] as const) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerType: "touch",
        pointerId: 1,
        clientX: x,
        clientY: 100,
      });
      fireEvent(message, event);
    }
    expect(document.activeElement).toBe(screen.getByLabelText("Message"));
    expect(screen.getByLabelText("Reply preview").textContent).toContain(
      "Reply to peer@test.invalid",
    );
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value,
    ).toBe("My draft reply");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("My draft reply", undefined, 77),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Reply preview")).toBeNull(),
    );
  });
  it("keeps the unread divider in place while updating the count, then resets it on reentry", async () => {
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const messages = [1, 2].map((id) => ({
      id,
      chatId: 3,
      senderId: 2,
      content: `Unread example ${id}`,
      createdAt: "2026-11-05T08:00:00Z",
    }));
    const history = { messages, users: [], unreadIds: [1, 2], unreadCount: 2 };
    mocks.history.mockResolvedValue(history);
    const first = setup(cache);
    const divider = await screen.findByText("Unread messages");
    expect(divider.getAttribute("data-unread-for")).toBe("1");
    const jump = screen.getByRole("button", { name: "Go to latest messages" });
    expect(within(jump).getByText("2")).toBeTruthy();
    const remaining = { ...history, unreadIds: [2], unreadCount: 1 };
    act(() => {
      cache.setQueryData(["history", 3], remaining);
    });
    await within(jump).findByText("1");
    expect(screen.getByText("Unread messages")).toBe(divider);
    expect(divider.getAttribute("data-unread-for")).toBe("1");
    first.unmount();

    mocks.history.mockResolvedValue(remaining);
    mocks.sync.mockResolvedValue(messages);
    const second = setup(cache);
    expect(
      (await screen.findByText("Unread messages")).getAttribute("data-unread-for"),
    ).toBe("2");
    act(() => {
      cache.setQueryData(["history", 3], { ...history, unreadIds: [], unreadCount: 0 });
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Go to latest messages" })).toBeNull(),
    );
    expect(
      screen.getByText("Unread messages").getAttribute("data-unread-for"),
    ).toBe("2");
    second.unmount();

    mocks.history.mockResolvedValue({ ...history, unreadIds: [], unreadCount: 0 });
    setup(cache);
    await screen.findByText("Unread example 2");
    expect(screen.queryByText("Unread messages")).toBeNull();
  });

  it("shows the jump button above the bottom, scrolls to the end and hides it again", async () => {
    mocks.history.mockResolvedValue({
      messages: [
        {
          id: 1,
          chatId: 3,
          senderId: 2,
          content: "Latest content",
          createdAt: "2026-11-05T08:00:00Z",
        },
      ],
      users: [],
      unreadIds: [],
    });
    setup();
    await screen.findByText("Latest content");
    const log = screen.getByRole("log", { name: "Messages" });
    Object.defineProperties(log, {
      clientHeight: { value: 300 },
      scrollHeight: { value: 1000 },
    });
    log.scrollTop = 700;
    fireEvent.scroll(log);
    expect(
      screen.queryByRole("button", { name: "Go to latest messages" }),
    ).toBeNull();
    log.scrollTop = 300;
    fireEvent.scroll(log);
    const jump = screen.getByRole("button", { name: "Go to latest messages" });
    const scroll = vi.fn(() => {
      log.scrollTop = 700;
    });
    Object.defineProperty(log, "scrollTo", { value: scroll });
    fireEvent.click(jump);
    expect(scroll).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
    expect(log.scrollTop).toBe(700);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Go to latest messages" }),
      ).toBeNull(),
    );
  });
  it("opens quick reactions and the expanded picker, then adds and removes a reaction", async () => {
    mocks.history.mockResolvedValue({
      messages: [
        {
          id: 73,
          chatId: 3,
          senderId: 2,
          content: "React to this",
          createdAt: "2026-11-06T09:00:00Z",
        },
      ],
      users: [],
      unreadIds: [],
    });
    mocks.reaction
      .mockResolvedValueOnce({
        chatId: 3,
        messageId: 73,
        reactionVersion: 1,
        reactions: [{ userId: 1, emoji: "🔥" }],
      })
      .mockResolvedValueOnce({
        chatId: 3,
        messageId: 73,
        reactionVersion: 2,
        reactions: [],
      });
    setup();
    fireEvent.contextMenu(await screen.findByText("React to this"));
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(6);
    fireEvent.click(screen.getByRole("menuitem", { name: "More reactions" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "🔥" }));
    const chip = await screen.findByRole("button", { name: "🔥 1 reaction" });
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(mocks.reaction).toHaveBeenNthCalledWith(1, 3, 73, "🔥");
    fireEvent.click(chip);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "🔥 1 reaction" }),
      ).toBeNull(),
    );
    expect(mocks.reaction).toHaveBeenNthCalledWith(2, 3, 73, null);
  });

  it.each(["context menu", "touch hold"])(
    "shows only the selected emoji's reactors via %s without changing the reaction",
    async (gesture) => {
      mocks.history.mockResolvedValue({
        messages: [
          {
            id: 73,
            chatId: 3,
            senderId: 2,
            content: "React to this",
            createdAt: "2026-11-06T09:00:00Z",
            reactions: [
              { userId: 1, emoji: "🔥", user: { email: "Alice" } },
              { userId: 2, emoji: "🔥", user: { email: "Bob" } },
              { userId: 3, emoji: "👍", user: { email: "Charlie" } },
            ],
          },
        ],
        users: [],
        unreadIds: [],
      });
      setup();
      const chip = await screen.findByRole("button", { name: "🔥 2 reactions" });
      if (gesture === "context menu") {
        fireEvent.contextMenu(chip);
      } else {
        const down = Object.assign(new Event("pointerdown", { bubbles: true }), {
          pointerType: "touch",
          pointerId: 1,
          clientX: 30,
          clientY: 30,
        });
        fireEvent(chip, down);
        await screen.findByRole("dialog", { name: "Reactions for 🔥" });
        fireEvent.pointerUp(chip);
        fireEvent.click(chip);
      }
      const popup = screen.getByRole("dialog", { name: "Reactions for 🔥" });
      expect(within(popup).getByText("Alice")).toBeTruthy();
      expect(within(popup).getByText("Bob")).toBeTruthy();
      expect(within(popup).queryByText("Charlie")).toBeNull();
      expect(screen.queryByRole("menu", { name: "Chat actions" })).toBeNull();
      expect(mocks.reaction).not.toHaveBeenCalled();
    },
  );

  it("pins from the message menu, jumps from the pin list to unloaded history, and unpins", async () => {
    const latest = {
      id: 73,
      chatId: 3,
      senderId: 2,
      content: "Pin this message",
      createdAt: "2026-11-06T09:00:00Z",
    };
    const older = { ...latest, id: 30, content: "An older pin" };
    mocks.history.mockResolvedValue({
      messages: [latest],
      users: [],
      unreadIds: [],
    });
    mocks.pins.mockResolvedValue([older]);
    mocks.setPin.mockImplementation(async (_chatId, _messageId, pinned) => {
      mocks.pins.mockResolvedValue(pinned ? [latest, older] : [older]);
    });
    mocks.window.mockResolvedValue({
      messages: [older],
      beforeId: null,
      afterId: 30,
    });
    setup();
    fireEvent.contextMenu(await screen.findByText(latest.content));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin message" }));
    await screen.findByRole("button", {
      name: /Pinned message Pin this message/,
    });
    expect(mocks.setPin).toHaveBeenCalledWith(3, 73, true);
    fireEvent.contextMenu(
      document.querySelector('[data-message-id="73"] .message-bubble')!,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpin message" }));
    await screen.findByRole("button", { name: /Pinned message An older pin/ });
    expect(mocks.setPin).toHaveBeenCalledWith(3, 73, false);
    fireEvent.click(
      screen.getByRole("button", { name: "View all pinned messages" }),
    );
    await screen.findByRole("heading", { name: "1 pinned message" });
    fireEvent.click(
      screen.getByRole("button", { name: /An older pin.*Go to message/ }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "1 pinned message" }),
      ).toBeNull();
      expect(document.querySelector('[data-message-id="30"]')).toBeTruthy();
    });
    expect(mocks.window.mock.calls[0][1]).toEqual({ aroundId: 30 });
  });
});
