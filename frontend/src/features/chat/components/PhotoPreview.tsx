import { useRef } from "react";
import { Plus, Send, X } from "lucide-react";
import { LocalPreview } from "@/features/uploads/Media";
import { PhotoGrid } from "@/features/uploads/PhotoGallery";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";

export const maxAlbumPhotos = 10;

export function PhotoPreview({
  photos,
  mimeTypes,
  grouped,
  caption,
  error,
  connected,
  onGroup,
  onCaption,
  onAdd,
  onRemove,
  onClose,
  onSend,
}: {
  photos: { key: number; file: File }[];
  mimeTypes: string[];
  grouped: boolean;
  caption: string;
  error: string;
  connected: boolean;
  onGroup: (grouped: boolean) => void;
  onCaption: (caption: string) => void;
  onAdd: (files: File[]) => void;
  onRemove: (key: number) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const container =
    document.querySelector<HTMLElement>(".chat-viewport") ?? undefined;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        container={container}
        showCloseButton={false}
        className={cn(
          "flex max-h-[calc(var(--chat-height,100dvh)-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
          container && "absolute",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
          <DialogTitle className="flex-1">
            {photos.length} {photos.length === 1 ? "photo" : "photos"} selected
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Close photo preview"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
          <DialogDescription className="sr-only">
            Review photos and write an optional caption before sending.
          </DialogDescription>
          <PhotoGrid count={photos.length} className="mx-auto w-full">
            {photos.map(({ key, file }, index) => (
              <div
                key={key}
                className={cn(
                  "relative min-h-0 min-w-0 overflow-hidden bg-muted",
                  photos.length === 1 && "grid max-h-72 place-items-center",
                )}
              >
                <LocalPreview
                  file={file}
                  className={
                    photos.length === 1
                      ? "block max-h-72 max-w-full object-contain"
                      : "absolute inset-0 size-full object-cover"
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  className="absolute top-1 right-1 size-10 rounded-full bg-black/65 text-white hover:bg-black/80"
                  aria-label={`Remove photo ${index + 1}: ${file.name}`}
                  onClick={() => onRemove(key)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </PhotoGrid>
          {photos.length > 1 && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(event) => onGroup(event.target.checked)}
                className="size-5 accent-primary"
              />
              Group photos in one message
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span>Caption</span>
            <textarea
              value={caption}
              onChange={(event) => onCaption(event.target.value)}
              placeholder="Add a caption…"
              maxLength={10000}
              rows={2}
              dir="auto"
              className="block w-full resize-none rounded-lg border border-input bg-muted/60 p-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!connected && (
            <p role="status" className="text-sm text-muted-foreground">
              Waiting for connection…
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t p-3">
          <input
            ref={picker}
            aria-label="Choose more photos"
            type="file"
            hidden
            multiple
            accept={mimeTypes.join(",")}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (files.length) onAdd(files);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={photos.length >= maxAlbumPhotos}
            onClick={() => picker.current?.click()}
          >
            <Plus /> Add photos
          </Button>
          <Button
            type="button"
            className="ml-auto min-h-11"
            disabled={!photos.length || !connected}
            onClick={onSend}
          >
            <Send /> Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UploadingMedia({
  file,
  progress,
  caption,
  cancel,
}: {
  file: File;
  progress: number;
  caption: string;
  cancel: () => void;
}) {
  return (
    <div className="my-3 flex justify-end">
      <div className="max-w-[85%] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative grid min-h-28 min-w-36 place-items-center bg-black">
          <LocalPreview
            file={file}
            className="block max-h-64 max-w-full object-contain"
          />
          <Button
            type="button"
            size="icon"
            className="absolute size-12 rounded-full bg-black/70 text-white hover:bg-black/85"
            aria-label="Cancel upload"
            onClick={cancel}
          >
            <X />
          </Button>
          <span
            role="status"
            className="absolute right-2 bottom-2 rounded bg-black/70 px-2 text-xs text-white"
          >
            {progress < 100 ? `${progress}%` : "Processing…"}
          </span>
        </div>
        <progress
          className="block h-1 w-full accent-primary"
          aria-label="Upload progress"
          value={progress}
          max={100}
        />
        {caption.trim() && (
          <p
            className="whitespace-pre-wrap break-words px-3 py-2 text-sm [overflow-wrap:anywhere]"
            dir="auto"
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
