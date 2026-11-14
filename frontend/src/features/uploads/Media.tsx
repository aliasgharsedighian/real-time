import { useEffect, useRef, useState, type ReactEventHandler } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, Play, X } from "lucide-react";
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
import { formatFileSize, TransferProgress } from "./TransferProgress";
import type { MediaFile } from "./api";

export async function fetchFileBlob(
  id: string,
  signal: AbortSignal,
  onProgress?: (loaded: number, total?: number) => void,
) {
  return (
    await api.get<Blob>(`files/${id}/content`, {
      signal,
      responseType: "blob",
      timeout: 120_000,
      ...(onProgress && {
        onDownloadProgress: ({ loaded, total }) => onProgress(loaded, total),
      }),
    })
  ).data;
}

// Revoke each consumer's URL on unmount/account change, while sharing authenticated Blob requests.
export function useFileUrl(id?: string | null) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const query = useQuery({
    queryKey: ["media", identity, id],
    enabled: !!id && !!identity,
    queryFn: ({ signal }) => fetchFileBlob(id!, signal),
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
  if (file.kind === "MUSIC") return <DeferredMusic key={file.id} file={file} />;
  if (file.kind === "DOCUMENT") return <DocumentAttachment file={file} />;
  return file.kind === "VIDEO" ? (
    <VideoAttachment file={file} />
  ) : (
    <InlineMedia file={file} />
  );
}

function DeferredMusic({ file }: { file: MediaFile }) {
  const [requested, setRequested] = useState(false);
  if (requested) return <InlineMedia file={file} />;
  return (
    <Button type="button" variant="ghost" onClick={() => setRequested(true)}>
      <Play />
      <span className="truncate" dir="auto">{file.title || "Music"}</span>
    </Button>
  );
}

function DocumentAttachment({ file }: { file: MediaFile }) {
  const filename = file.title || "download";
  const request = useRef<AbortController>(null);
  const [percent, setPercent] = useState(0);
  useEffect(() => () => request.current?.abort(), []);
  const download = useMutation({
    mutationFn: async () => {
      const controller = request.current;
      if (!controller) return;
      try {
        const blob = await fetchFileBlob(file.id, controller.signal, (loaded, total) => {
          if (!controller.signal.aborted)
            setPercent(Math.min(99, Math.floor(100 * loaded / (total || file.size || 1))));
        });
        controller.signal.throwIfAborted();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } finally {
        request.current = null;
      }
    },
  });

  return (
    <div className="w-[min(16rem,62vw)] max-w-full">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="group size-11 shrink-0 rounded-full p-0"
          aria-label={`Download ${filename}`}
          aria-busy={download.isPending}
          disabled={download.isPending}
          onClick={() => {
            if (request.current) return;
            request.current = new AbortController();
            setPercent(0);
            download.mutate();
          }}
        >
          {download.isPending ? (
            <TransferProgress percent={percent} />
          ) : (
            <>
              <FileText className="group-hover:hidden group-focus-visible:hidden" />
              <Download className="hidden group-hover:block group-focus-visible:block" />
            </>
          )}
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" dir="auto" title={filename}>{filename}</p>
          <p className="text-xs text-muted-foreground">
            {download.isPending ? "Downloading…" : formatFileSize(file.size)}
          </p>
        </div>
      </div>
      {download.isError && (
        <p role="alert" className="mt-1 text-xs">Unable to download file. Try again.</p>
      )}
    </div>
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
      {(file.kind === "AUDIO" || file.kind === "MUSIC") ? (
        <audio
          src={media.url}
          controls
          preload="metadata"
          aria-label={file.kind === "MUSIC" ? "Music attachment" : "Voice message"}
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
        download={`batgram-${file.id}.${file.kind === "AUDIO" || file.kind === "MUSIC" ? "m4a" : "webp"}`}
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
  onImageLoad,
}: {
  file: File;
  className?: string;
  onImageLoad?: ReactEventHandler<HTMLImageElement>;
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
      onLoad={onImageLoad}
      className={className ?? "max-h-40 max-w-full rounded-lg object-contain"}
    />
  );
}
