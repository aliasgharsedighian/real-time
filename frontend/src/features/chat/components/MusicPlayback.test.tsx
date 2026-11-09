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
import { fetchFileBlob } from "@/features/uploads/Media";
import type { MediaFile } from "@/features/uploads/api";
import { getSharedContent } from "../api";
import { MusicMessage, MusicPlaybackBar } from "./MusicPlayback";
import { VoicePlaybackProvider } from "./VoicePlayback";

vi.mock("@/features/uploads/Media", () => ({ fetchFileBlob: vi.fn() }));
vi.mock("../api", () => ({ getSharedContent: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

const track = (id: string, title: string): MediaFile => ({
  id,
  title,
  artist: "Mina",
  kind: "MUSIC",
  mimeType: "audio/mp4",
  size: 100,
  duration: 30,
  width: 0,
  height: 0,
});

it("plays adjacent music from the source chat across pages and keeps playing when the sheet closes", async () => {
  const first = track("first", "First song");
  const second = track("second", "Second song");
  const third = track("third", "Third song");
  vi.mocked(getSharedContent).mockImplementation(
    async (_chat, _kind, before) => ({
      counts: { IMAGE: 0, VIDEO: 0, AUDIO: 0, MUSIC: 3, LINK: 0 },
      messages: (before ? [first] : [third, second]).map((file) => ({
        id: file === first ? 1 : file === second ? 2 : 3,
        chatId: 7,
        senderId: 2,
        content: "",
        createdAt: "",
        attachments: [file],
      })),
      nextCursor: before ? null : 2,
    }),
  );
  vi.mocked(fetchFileBlob).mockResolvedValue(new Blob());
  const players: FakeAudio[] = [];
  class FakeAudio {
    paused = true;
    ended = false;
    currentTime = 0;
    duration = 30;
    onplay?: () => void;
    onpause?: () => void;
    onended?: () => void;
    constructor() {
      players.push(this);
    }
    async play() {
      this.paused = false;
      this.ended = false;
      this.onplay?.();
    }
    pause() {
      this.paused = true;
      this.onpause?.();
    }
    removeAttribute() {}
    load() {}
  }
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:music",
      revokeObjectURL: vi.fn(),
    }),
  );

  const client = new QueryClient();
  function dashboard(inChat: boolean) {
    return (
      <QueryClientProvider client={client}>
        <VoicePlaybackProvider>
          <MusicPlaybackBar />
          {inChat && <MusicMessage chatId={7} file={second} />}
        </VoicePlaybackProvider>
      </QueryClientProvider>
    );
  }
  const { rerender } = render(dashboard(true));
  fireEvent.click(screen.getByRole("button", { name: "Play Second song" }));
  await screen.findByRole("button", { name: "Pause music" });
  rerender(dashboard(false));
  expect(players[0].paused).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Open music playlist" }));
  const sheet = within(screen.getByRole("dialog", { name: "Music playlist" }));
  await sheet.findByRole("button", { name: "Play First song" });
  expect(getSharedContent).toHaveBeenCalledWith(
    7,
    "MUSIC",
    2,
    expect.any(AbortSignal),
  );

  fireEvent.click(sheet.getByRole("button", { name: "Previous track" }));
  await sheet.findByRole("button", { name: "Pause First song" });
  act(() => {
    players[1].ended = true;
    players[1].paused = true;
    players[1].onended?.();
  });
  await sheet.findByRole("button", { name: "Pause Second song" });
  fireEvent.click(sheet.getByRole("button", { name: "Next track" }));
  await sheet.findByRole("button", { name: "Pause Third song" });

  fireEvent.click(
    sheet.getByRole("button", { name: "Repeat off. Change repeat mode" }),
  );
  fireEvent.click(
    sheet.getByRole("button", { name: "Repeat all. Change repeat mode" }),
  );
  act(() => {
    players[3].ended = true;
    players[3].paused = true;
    players[3].onended?.();
  });
  await waitFor(() => expect(players[3].paused).toBe(false));
  expect(players).toHaveLength(4);
  fireEvent.click(sheet.getByRole("button", { name: "Shuffle" }));
  expect(
    sheet.getByRole("button", { name: "Shuffle" }).getAttribute("aria-pressed"),
  ).toBe("true");

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeTruthy();
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId = 1;
    },
  );
  const dialog = screen.getByRole("dialog");
  const handle = sheet.getByRole("button", { name: "Close music playlist" });
  fireEvent.pointerDown(handle, { button: 0, clientY: 100 });
  fireEvent.pointerMove(handle, { clientY: 175 });
  expect(dialog.style.translate).toBe("0 75px");
  fireEvent.pointerMove(handle, { clientY: 120 });
  expect(dialog.style.translate).toBe("0 20px");
  fireEvent.pointerUp(handle, { clientY: 120 });
  fireEvent.click(handle, { detail: 1 });
  expect(dialog.style.translate).toBe("0 0px");
  expect(screen.getByRole("dialog")).toBe(dialog);

  fireEvent.pointerDown(handle, { button: 0, clientY: 100 });
  fireEvent.pointerMove(handle, { clientY: 230 });
  fireEvent.pointerUp(handle, { clientY: 230 });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(players[3].paused).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Open music playlist" }));
  expect(screen.getByRole("dialog").style.translate).toBe("0 0px");
  fireEvent.click(screen.getByRole("button", { name: "Close music playlist" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(players[3].paused).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "Stop music and close player" }),
  );
  expect(players[3].paused).toBe(true);
});

it("shows transfer progress and saves the authenticated music download", async () => {
  const file = track("download", "Evening");
  let finish!: (blob: Blob) => void;
  let report!: (loaded: number, total?: number) => void;
  vi.mocked(fetchFileBlob).mockImplementationOnce(
    (_id, _signal, onProgress) => {
      report = onProgress!;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  );
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:download",
      revokeObjectURL: vi.fn(),
    }),
  );
  const save = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  try {
    render(<MusicMessage file={file} chatId={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Download Evening" }));
    act(() => report(35, 100));
    expect(
      screen.getByRole("button", { name: "Downloading 35%" }),
    ).toBeTruthy();
    await act(async () => finish(new Blob()));
    expect(save.mock.contexts[0]).toMatchObject({
      href: "blob:download",
      download: "Evening.m4a",
    });
    expect(
      screen.getByRole("button", { name: "Download Evening" }),
    ).toBeTruthy();
  } finally {
    save.mockRestore();
  }
});
