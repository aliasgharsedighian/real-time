import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Play, X } from "lucide-react";
import { useSessionStore } from "@/features/auth/session-store";
import { api } from "@/shared/lib/api";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import type { MediaFile } from "./api";

// Revoke each consumer's URL on unmount/account change, while sharing authenticated Blob requests.
export function useFileUrl(id?: string | null) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const query = useQuery({
    queryKey: ["media", identity, id],
    enabled: !!id && !!identity,
    queryFn: async ({ signal }) =>
      (
        await api.get<Blob>(`files/${id}/content`, {
          signal,
          responseType: "blob",
          timeout: 120_000,
        })
      ).data,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  });
  const [resource, setResource] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setResource({ blob: query.data, url });
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  return {
    ...query,
    url: resource?.blob === query.data ? resource?.url : undefined,
  };
}
export function Media({ file }: { file: MediaFile }) {
  return file.kind === "VIDEO" ? (
    <VideoAttachment file={file} />
  ) : (
    <InlineMedia file={file} />
  );
}

function VideoAttachment({ file }: { file: MediaFile }) {
  const [open, setOpen] = useState(false);
  const seconds = Math.floor(file.duration ?? 0);
  const duration =
    seconds > 0
      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
      : null;
  const aspectRatio =
    file.width > 0 && file.height > 0
      ? Math.max(3 / 4, Math.min(16 / 9, file.width / file.height))
      : 16 / 9;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Open video"
          className="relative grid w-[min(18rem,68vw)] max-w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-muted to-black/80 text-white focus-visible:ring-2 focus-visible:ring-ring"
          style={{ aspectRatio }}
        >
          <span className="grid size-12 place-items-center rounded-full bg-black/55 ring-1 ring-white/30">
            <Play className="size-5 fill-current" />
          </span>
          <span className="absolute right-2 bottom-2 rounded bg-black/65 px-2 text-xs">
            {duration ?? "Video"}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 bg-black/95 p-0 text-white sm:max-w-none"
      >
        {open && <VideoPlayer file={file} />}
      </DialogContent>
    </Dialog>
  );
}

function VideoPlayer({ file }: { file: MediaFile }) {
  const media = useFileUrl(file.id);
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(.5rem,env(safe-area-inset-top))] pb-2">
        <DialogTitle className="flex-1 text-sm">Video</DialogTitle>
        {media.url && (
          <Button asChild variant="ghost" size="icon" className="size-11">
            <a
              href={media.url}
              download={`batgram-${file.id}.mp4`}
              aria-label="Download video"
            >
              <Download />
            </a>
          </Button>
        )}
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Close video"
          >
            <X />
          </Button>
        </DialogClose>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {media.isError ? (
          <div role="alert" className="space-y-3 p-4 text-center">
            <p>Unable to load video.</p>
            <Button variant="secondary" onClick={() => void media.refetch()}>
              Retry
            </Button>
          </div>
        ) : !media.url ? (
          <p role="status">Loading video…</p>
        ) : failedUrl === media.url ? (
          <p role="alert" className="p-4 text-center">
            Unable to play this video. You can still download it.
          </p>
        ) : (
          <video
            src={media.url}
            controls
            autoPlay
            playsInline
            aria-label="Chat video"
            className="block size-full object-contain"
            onError={() => setFailedUrl(media.url)}
          />
        )}
      </div>
    </>
  );
}

function InlineMedia({ file }: { file: MediaFile }) {
  const media = useFileUrl(file.id);
  if (media.isError)
    return (
      <div className="p-3 text-sm" role="alert">
        Unable to load attachment.{" "}
        <Button variant="link" onClick={() => void media.refetch()}>
          Retry
        </Button>
      </div>
    );
  if (!media.url)
    return (
      <p role="status" className="p-4 text-sm">
        Loading attachment…
      </p>
    );
  return (
    <div className="max-w-full space-y-1">
      {file.kind === "AUDIO" ? (
        <audio
          src={media.url}
          controls
          preload="metadata"
          aria-label="Voice message"
          className="w-64 max-w-full"
        />
      ) : (
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open full image"
        >
          <img
            src={media.url}
            alt="Chat attachment"
            width={file.width}
            height={file.height}
            className="max-h-96 max-w-full rounded-xl object-contain"
          />
        </a>
      )}
      <a
        href={media.url}
        download={`batgram-${file.id}.${file.kind === "AUDIO" ? "m4a" : "webp"}`}
        className="block text-xs underline"
      >
        Download · {(file.size / 1024 / 1024).toFixed(2)} MB
      </a>
    </div>
  );
}
export function LocalPreview({
  file,
  className,
}: {
  file: File;
  className?: string;
}) {
  const [resource, setResource] = useState<{ file: File; url: string }>();
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setResource({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const url = resource?.file === file ? resource?.url : undefined;
  return file.type.startsWith("audio/") ? (
    <audio
      src={url}
      controls
      preload="metadata"
      aria-label="Voice message preview"
      className="w-full max-w-sm"
    />
  ) : file.type.startsWith("video/") ? (
    <video
      src={url}
      controls
      preload="metadata"
      className={className ?? "max-h-40 max-w-full rounded-lg"}
    />
  ) : (
    <img
      src={url}
      alt="Selected attachment preview"
      className={className ?? "max-h-40 max-w-full rounded-lg object-contain"}
    />
  );
}
