import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import { useFileUrl } from "@/features/uploads/Media";
import type { MediaFile } from "@/features/uploads/api";
import { Button } from "@/shared/ui/button";

const speeds = [1, 1.5, 2] as const;

interface VoiceTrack {
  key: string;
  sender: string;
  duration: number;
}

interface Playback {
  track: VoiceTrack;
  playing: boolean;
  elapsed: number;
  duration: number;
}

const VoiceContext = createContext<{
  current: Playback | null;
  speed: number;
  start: (track: VoiceTrack, blob: Blob) => void;
  toggle: () => void;
  changeSpeed: () => void;
  stop: () => void;
} | null>(null);

export function VoicePlaybackProvider({ children }: { children: ReactNode }) {
  const player = useRef<{ audio: HTMLAudioElement; url: string }>(null);
  const [current, setCurrent] = useState<Playback | null>(null);
  const [speedIndex, setSpeedIndex] = useState(0);
  const speed = speeds[speedIndex];

  const release = useCallback(() => {
    const active = player.current;
    if (!active) return;
    player.current = null;
    active.audio.pause();
    active.audio.removeAttribute("src");
    active.audio.load();
    URL.revokeObjectURL(active.url);
  }, []);

  useEffect(() => release, [release]);

  function stop() {
    release();
    setCurrent(null);
  }

  function fail(audio: HTMLAudioElement) {
    if (player.current?.audio !== audio) return;
    stop();
    toast.error("Unable to play voice message.");
  }

  function play(audio: HTMLAudioElement) {
    void audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      fail(audio);
    });
  }

  function start(track: VoiceTrack, blob: Blob) {
    release();
    // The dashboard owns this URL even after the message bubble unmounts.
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    player.current = { audio, url };
    audio.playbackRate = speed;
    function sync() {
      if (player.current?.audio !== audio) return;
      setCurrent({
        track,
        playing: !audio.paused,
        elapsed: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : track.duration,
      });
    }
    audio.onplay = sync;
    audio.onpause = sync;
    audio.ontimeupdate = sync;
    audio.ondurationchange = sync;
    audio.onended = () => {
      if (player.current?.audio === audio) stop();
    };
    audio.onerror = () => fail(audio);
    play(audio);
    sync();
  }

  function toggle() {
    const audio = player.current?.audio;
    if (!audio) return;
    if (audio.paused) play(audio);
    else audio.pause();
  }

  function changeSpeed() {
    const next = (speedIndex + 1) % speeds.length;
    if (player.current) player.current.audio.playbackRate = speeds[next];
    setSpeedIndex(next);
  }

  return (
    <VoiceContext.Provider value={{ current, speed, start, toggle, changeSpeed, stop }}>
      {children}
    </VoiceContext.Provider>
  );
}

function progress(current: Playback | null) {
  return current?.duration ? Math.min(1, current.elapsed / current.duration) : 0;
}

function formatTime(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function VoicePlaybackBar() {
  const voice = useContext(VoiceContext);
  if (!voice?.current) return null;
  const { current, speed, toggle, changeSpeed, stop } = voice;
  const Icon = current.playing ? Pause : Play;

  return (
    <section
      aria-label="Voice message player"
      className="relative mx-3 my-2 grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_auto_2.75rem] items-center overflow-hidden rounded-full border border-border bg-card/90 shadow-sm sm:mx-5"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        aria-label={current.playing ? "Pause voice message" : "Play voice message"}
        onClick={toggle}
      >
        <Icon className="fill-current" />
      </Button>
      <div className="min-w-0 text-center leading-tight">
        <p className="truncate text-sm font-medium" dir="auto">{current.track.sender}</p>
        <p className="text-xs text-muted-foreground">Voice Message</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 rounded-full px-2 tabular-nums"
        aria-label={`Playback speed x${speed}. Change speed`}
        onClick={changeSpeed}
      >
        x{speed}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        aria-label="Close voice player"
        onClick={stop}
      >
        <X />
      </Button>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
        style={{ transform: `scaleX(${progress(current)})` }}
      />
    </section>
  );
}

const waveHeights = Array.from({ length: 44 }, (_, index) =>
  4 + ((index * index * 13 + index * 7) % 23),
);

export function VoiceMessage({
  file,
  messageId,
  sender,
}: {
  file: MediaFile;
  messageId: number;
  sender: string;
}) {
  const voice = useContext(VoiceContext);
  const media = useFileUrl(file.id);
  const key = `${messageId}:${file.id}`;
  const current = voice?.current?.track.key === key ? voice.current : null;
  const Icon = current?.playing ? Pause : Play;
  const duration = file.duration ?? 0;
  const shownTime = current ? current.elapsed : duration;

  return (
    <div className="w-[min(17rem,58vw)] max-w-full">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="size-11 shrink-0 rounded-full ring-4 ring-primary/20"
          aria-label={current?.playing ? "Pause voice message" : "Play voice message"}
          disabled={!current && (!voice || !media.data)}
          onClick={() => {
            if (current) voice?.toggle();
            else if (media.data) voice?.start({ key, sender, duration }, media.data);
          }}
        >
          <Icon className="fill-current" />
        </Button>
        <div className="min-w-0 flex-1">
          <div aria-hidden="true" className="flex h-7 items-end justify-between gap-px">
            {waveHeights.map((height, index) => (
              <span
                key={index}
                className={`max-w-[3px] flex-1 rounded-full ${index < progress(current) * waveHeights.length ? "bg-brand" : "bg-current opacity-25"}`}
                style={{ height }}
              />
            ))}
          </div>
          {media.isError ? (
            <button type="button" className="text-xs underline" onClick={() => void media.refetch()}>
              Retry voice download
            </button>
          ) : (
            <span className="block text-xs tabular-nums text-muted-foreground">
              {media.isPending ? "Loading voice…" : formatTime(shownTime)}
            </span>
          )}
        </div>
      </div>
      {media.url && (
        <a href={media.url} download={`batgram-${file.id}.m4a`} className="ml-14 text-xs underline">
          Download · {(file.size / 1024 / 1024).toFixed(2)} MB
        </a>
      )}
    </div>
  );
}
