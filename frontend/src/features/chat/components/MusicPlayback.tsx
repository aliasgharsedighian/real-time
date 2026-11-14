import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSessionStore } from "@/features/auth/session-store";
import { fetchFileBlob } from "@/features/uploads/Media";
import { TransferProgress } from "@/features/uploads/TransferProgress";
import type { MediaFile } from "@/features/uploads/api";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { getSharedContent } from "../api";
import { getSocket } from "../socket";
import {
  formatPlaybackTime,
  playbackProgress,
  usePlayback,
} from "./VoicePlayback";

const trackTitle = (file: MediaFile) => file.title || "Music";
const trackArtist = (file: MediaFile) => file.artist || "Unknown artist";

async function getPlaylist(chatId: number, signal: AbortSignal) {
  const tracks = new Map<string, MediaFile>();
  let cursor: number | undefined;
  do {
    const page = await getSharedContent(chatId, "MUSIC", cursor, signal);
    for (const message of page.messages) {
      for (const file of message.attachments ?? []) {
        if (file.kind === "MUSIC") tracks.set(file.id, file);
      }
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return [...tracks.values()].reverse();
}

function shuffleRank(id: string, seed: number) {
  let rank = seed;
  for (const character of id)
    rank = Math.imul(rank ^ character.charCodeAt(0), 16777619);
  return rank >>> 0;
}

function MusicDownload({ file }: { file: MediaFile }) {
  const request = useRef<AbortController>(null);
  const [percent, setPercent] = useState<number | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function download() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPercent(0);
    try {
      const blob = await fetchFileBlob(
        file.id,
        controller.signal,
        (loaded, total) => {
          if (!controller.signal.aborted)
            setPercent(
              Math.min(
                99,
                Math.floor((100 * loaded) / (total || file.size || 1)),
              ),
            );
        },
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${trackTitle(file).replace(/[\\/:*?"<>|]/g, "_")}.m4a`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      if (!controller.signal.aborted) toast.error("Unable to download music.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPercent(null);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 rounded-full"
      aria-label={
        percent === null
          ? `Download ${trackTitle(file)}`
          : `Downloading ${percent}%`
      }
      disabled={percent !== null}
      onClick={() => void download()}
    >
      {percent === null ? (
        <Download />
      ) : (
        <TransferProgress percent={percent} />
      )}
    </Button>
  );
}

export function MusicMessage({
  file,
  chatId,
}: {
  file: MediaFile;
  chatId: number;
}) {
  const playback = usePlayback();
  const active =
    playback?.current?.track.music?.file.id === file.id
      ? playback.current
      : null;
  const Icon = active?.loading ? LoaderCircle : active?.playing ? Pause : Play;
  return (
    <div className="flex w-[min(20rem,62vw)] max-w-full items-center gap-2">
      <Button
        type="button"
        size="icon"
        className="size-11 shrink-0 rounded-full ring-4 ring-primary/15"
        aria-label={`${active?.playing ? "Pause" : "Play"} ${trackTitle(file)}`}
        aria-busy={active?.loading}
        disabled={!playback || active?.loading}
        onClick={() =>
          active ? playback?.toggle() : playback?.startMusic(chatId, file)
        }
      >
        {active?.loading && active.transferPercent !== undefined ? (
          <TransferProgress percent={active.transferPercent} />
        ) : (
          <Icon className={active?.loading ? "animate-spin" : "fill-current"} />
        )}
      </Button>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-semibold text-brand" dir="auto">
          {trackTitle(file)}
        </p>
        <p className="truncate text-xs text-muted-foreground" dir="auto">
          {trackArtist(file)} · {formatPlaybackTime(file.duration ?? 0)}
        </p>
        {active?.needsPlayGesture && (
          <p role="status" className="text-xs text-muted-foreground">
            Ready to play. Tap Play.
          </p>
        )}
      </div>
      <MusicDownload file={file} />
    </div>
  );
}

export function MusicPlaybackBar() {
  const playback = usePlayback();
  const music = playback?.current?.track.music;
  if (!music || !playback?.current) return null;
  return (
    <MusicPlayer
      key={music.chatId}
      playback={playback}
      chatId={music.chatId}
      file={music.file}
    />
  );
}

function MusicPlayer({
  playback,
  chatId,
  file,
}: {
  playback: NonNullable<ReturnType<typeof usePlayback>>;
  chatId: number;
  file: MediaFile;
}) {
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const [open, setOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; startY: number }>(null);
  const suppressHandleClick = useRef(false);

  function cancelDrag(pointerId: number) {
    if (drag.current?.pointerId !== pointerId) return;
    drag.current = null;
    suppressHandleClick.current = true;
    setDragging(false);
    setDragOffset(0);
  }

  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [shuffle, setShuffle] = useState<{ seed: number; first: string }>();
  const { current, toggle, stop, startMusic, seek, acknowledgeEnd } = playback;
  useEffect(() => {
    const socket = getSocket();
    const removed = (event: { chatId: number }) => {
      if (event.chatId === chatId) stop();
    };
    socket.on("chat:removed", removed);
    return () => {
      socket.off("chat:removed", removed);
    };
  }, [chatId, stop]);
  const playlist = useQuery({
    queryKey: ["shared-content", identity, chatId, "playlist"],
    queryFn: ({ signal }) => getPlaylist(chatId, signal),
    enabled: open || repeat === "all",
    staleTime: 30_000,
  });
  const queue = useMemo(() => {
    if (!shuffle) return playlist.data ?? [];
    return [...(playlist.data ?? [])].sort((a, b) => {
      if (a.id === shuffle.first) return -1;
      if (b.id === shuffle.first) return 1;
      return shuffleRank(a.id, shuffle.seed) - shuffleRank(b.id, shuffle.seed);
    });
  }, [playlist.data, shuffle]);
  const index = queue.findIndex((track) => track.id === file.id);
  const previous =
    index > 0
      ? queue[index - 1]
      : repeat === "all" && index === 0
        ? queue.at(-1)
        : undefined;
  const next =
    index < 0
      ? undefined
      : (queue[index + 1] ?? (repeat === "all" ? queue[0] : undefined));
  const ended = current?.ended;

  useEffect(() => {
    if (!ended || (repeat === "all" && playlist.isPending)) return;
    acknowledgeEnd();
    if (repeat === "one" || next?.id === file.id) toggle();
    else if (repeat === "all" && next) startMusic(chatId, next);
  }, [
    acknowledgeEnd,
    chatId,
    ended,
    file.id,
    next,
    playlist.isPending,
    repeat,
    startMusic,
    toggle,
  ]);

  const Icon = current?.loading
    ? LoaderCircle
    : current?.playing
      ? Pause
      : Play;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const playLabel = current?.playing ? "Pause music" : "Play music";
  const elapsed = current?.elapsed ?? 0;
  const duration = current?.duration ?? 0;
  const progress = playbackProgress(current);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDragOffset(0);
          suppressHandleClick.current = false;
        }
        setOpen(nextOpen);
      }}
    >
      <section
        aria-label="Music player"
        className="relative mx-3 my-2 grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center overflow-hidden rounded-full border border-border bg-card/90 shadow-sm sm:mx-5"
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full"
          disabled={current?.loading}
          aria-label={playLabel}
          onClick={toggle}
        >
          <Icon
            className={current?.loading ? "animate-spin" : "fill-current"}
          />
        </Button>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Open music playlist"
            className="min-w-0 rounded-full px-2 py-1 text-center leading-tight hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="block truncate text-sm font-medium" dir="auto">
              {trackTitle(file)}
            </span>
            <span
              className="block truncate text-xs text-muted-foreground"
              dir="auto"
            >
              {trackArtist(file)}
            </span>
          </button>
        </DialogTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full"
          aria-label="Stop music and close player"
          onClick={stop}
        >
          <X />
        </Button>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
        >
          <MusicProgress progress={progress} />
        </span>
      </section>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        style={{ translate: `0 ${dragOffset}px` }}
        className={`inset-x-0 top-auto bottom-0 mx-auto flex h-[min(88dvh,48rem)] max-w-[min(100%,34rem)] translate-x-0 translate-y-0 flex-col gap-0 rounded-t-3xl rounded-b-none bg-card p-0 duration-250 ease-out data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom motion-reduce:animate-none! ${!dragging && open ? "motion-safe:transition-[translate]" : ""}`}
      >
        <DialogTitle className="sr-only">Music playlist</DialogTitle>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close music playlist"
            className="grid h-10 shrink-0 cursor-grab touch-none place-items-center rounded-t-3xl hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:cursor-grabbing"
            onPointerDown={(event) => {
              if (event.button !== 0 || drag.current) return;
              suppressHandleClick.current = false;
              drag.current = {
                pointerId: event.pointerId,
                startY: event.clientY,
              };
              event.currentTarget.setPointerCapture?.(event.pointerId);
              setDragging(true);
            }}
            onPointerMove={(event) => {
              const gesture = drag.current;
              if (gesture?.pointerId !== event.pointerId) return;
              const distance = event.clientY - gesture.startY;
              if (Math.abs(distance) > 5) suppressHandleClick.current = true;
              setDragOffset(Math.max(0, distance));
            }}
            onPointerUp={(event) => {
              const gesture = drag.current;
              if (gesture?.pointerId !== event.pointerId) return;
              const distance = event.clientY - gesture.startY;
              drag.current = null;
              setDragging(false);
              if (Math.abs(distance) > 5) suppressHandleClick.current = true;
              if (distance >= 100) {
                setDragOffset(distance);
                setOpen(false);
              } else {
                setDragOffset(0);
              }
            }}
            onPointerCancel={(event) => cancelDrag(event.pointerId)}
            onLostPointerCapture={(event) => cancelDrag(event.pointerId)}
            onClick={(event) => {
              if (event.detail && suppressHandleClick.current)
                event.preventDefault();
            }}
          >
            <span className="h-1.5 w-11 rounded-full bg-muted-foreground/50" />
          </button>
        </DialogClose>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4">
          {playlist.isPending && (
            <p role="status" className="p-4 text-sm">
              Loading playlist…
            </p>
          )}
          {playlist.isError && (
            <Button variant="ghost" onClick={() => void playlist.refetch()}>
              Retry playlist
            </Button>
          )}
          <ul className="divide-y divide-border">
            {(queue.length ? queue : [file]).map((track) => {
              const selected = track.id === file.id;
              const TrackIcon = selected ? Icon : Play;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    aria-label={`${selected && current?.playing ? "Pause" : "Play"} ${trackTitle(track)}`}
                    disabled={selected && current?.loading}
                    onClick={() =>
                      selected ? toggle() : startMusic(chatId, track)
                    }
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-start hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? "bg-primary/10" : ""}`}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                      <TrackIcon
                        className={`size-4 ${selected && current?.loading ? "animate-spin" : "fill-current"}`}
                      />
                    </span>
                    <span className="min-w-0">
                      <span dir="auto" className="block truncate font-medium">
                        {trackTitle(track)}
                      </span>
                      <span
                        dir="auto"
                        className="block truncate text-sm text-muted-foreground"
                      >
                        {formatPlaybackTime(track.duration ?? 0)} ·{" "}
                        {trackArtist(track)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="shrink-0 border-t border-border bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-brand">
              <Music2 />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" dir="auto">
                {trackTitle(file)}
              </p>
              <p className="truncate text-sm text-muted-foreground" dir="auto">
                {trackArtist(file)}
              </p>
            </div>
            <MusicDownload file={file} key={file.id} />
          </div>
          <div className="relative mt-3 flex h-7 items-center">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <MusicProgress progress={progress} />
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-brand motion-safe:transition-[left] motion-safe:duration-250 motion-safe:ease-linear"
              style={{ left: `${progress * 100}%` }}
            />
            <input
              type="range"
              aria-label="Seek in music"
              aria-valuetext={formatPlaybackTime(elapsed)}
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(elapsed, duration)}
              disabled={current?.loading || !duration}
              onChange={(event) => seek(event.currentTarget.valueAsNumber)}
              className="relative h-full w-full cursor-pointer appearance-none bg-transparent focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-transparent [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-transparent"
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span aria-label="Elapsed">{formatPlaybackTime(elapsed)}</span>
            <span aria-label="Remaining">
              −{formatPlaybackTime(Math.max(0, duration - elapsed))}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Shuffle"
              aria-pressed={!!shuffle}
              className={shuffle ? "text-brand" : ""}
              onClick={() =>
                setShuffle(
                  shuffle
                    ? undefined
                    : { seed: Math.random() * 2 ** 32, first: file.id },
                )
              }
            >
              <Shuffle />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous track"
              disabled={!previous}
              onClick={() => previous && startMusic(chatId, previous)}
            >
              <SkipBack className="fill-current" />
            </Button>
            <Button
              size="icon"
              className="size-12 rounded-full"
              aria-label={playLabel}
              disabled={current?.loading}
              onClick={toggle}
            >
              <Icon
                className={current?.loading ? "animate-spin" : "fill-current"}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next track"
              disabled={!next}
              onClick={() => next && startMusic(chatId, next)}
            >
              <SkipForward className="fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Repeat ${repeat}. Change repeat mode`}
              className={repeat === "off" ? "" : "text-brand"}
              onClick={() =>
                setRepeat(
                  repeat === "off" ? "all" : repeat === "all" ? "one" : "off",
                )
              }
            >
              <RepeatIcon />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MusicProgress({ progress }: { progress: number }) {
  return (
    <span
      className="absolute inset-0 origin-left bg-brand motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-linear"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}
