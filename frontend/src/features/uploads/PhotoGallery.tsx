import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { useFileUrl } from "./Media";
import type { MediaFile } from "./api";

export function PhotoGrid({
  children,
  count,
  portrait = false,
  className,
}: {
  children: ReactNode;
  count: number;
  portrait?: boolean;
  className?: string;
}) {
  const featured = count === 3 || count === 4;
  return (
    <div
      data-photo-grid
      className={cn(
        "grid w-[min(24rem,100%)] max-w-full gap-0.5 overflow-hidden rounded-xl",
        count === 1
          ? "grid-cols-1"
          : featured && portrait
            ? "aspect-[4/5] grid-cols-[2fr_1fr]"
            : featured
              ? count === 3
                ? "aspect-[4/3] grid-cols-2 grid-rows-[2fr_1fr] [&>*:first-child]:col-span-full"
                : "aspect-[4/3] grid-cols-3 grid-rows-[2fr_1fr] [&>*:first-child]:col-span-full"
              : "grid-cols-2 sm:grid-cols-3 [&>*]:aspect-square",
        featured &&
          portrait &&
          (count === 3
            ? "grid-rows-2 [&>*:first-child]:row-span-2"
            : "grid-rows-3 [&>*:first-child]:row-span-3"),
        count === 2 && "sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PhotoTile({
  file,
  single,
  index,
  open,
}: {
  file: MediaFile;
  single: boolean;
  index: number;
  open: (index: number, trigger: HTMLButtonElement) => void;
}) {
  const media = useFileUrl(file.id);
  const label = single ? "Open photo" : `Open photo ${index + 1}`;
  return (
    <button
      type="button"
      aria-label={label}
      data-photo-grid
      className={cn(
        "relative grid min-h-0 min-w-0 place-items-center overflow-hidden bg-muted text-xs focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        single && "max-w-full rounded-xl",
      )}
      style={
        single && file.width > 0 && file.height > 0
          ? {
              width: Math.min(
                file.width,
                384,
                (384 * file.width) / file.height,
              ),
              aspectRatio: file.width / file.height,
            }
          : undefined
      }
      onClick={(event) => open(index, event.currentTarget)}
    >
      {media.url ? (
        <img
          src={media.url}
          alt=""
          width={file.width}
          height={file.height}
          draggable={false}
          className={
            single
              ? "block h-auto max-h-96 w-full object-contain"
              : "absolute inset-0 size-full object-cover"
          }
        />
      ) : (
        <span className="p-2">
          {media.isError ? "Photo unavailable" : "Loading photo…"}
        </span>
      )}
    </button>
  );
}

export function MessagePhotos({
  photos,
  open,
}: {
  photos: MediaFile[];
  open: (index: number, trigger: HTMLButtonElement) => void;
}) {
  if (!photos.length) return null;
  if (photos.length === 1)
    return <PhotoTile file={photos[0]} single index={0} open={open} />;
  return (
    <PhotoGrid
      count={photos.length}
      portrait={photos[0].height > photos[0].width}
      className="w-[min(24rem,70vw)]"
    >
      {photos.map((file, index) => (
        <PhotoTile
          key={file.id}
          file={file}
          single={false}
          index={index}
          open={open}
        />
      ))}
    </PhotoGrid>
  );
}

export function PhotoGallery({
  photos,
  initialIndex,
  trigger,
  onClose,
}: {
  photos: MediaFile[];
  initialIndex: number;
  trigger: HTMLButtonElement;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const file = photos[index];
  const photo = useFileUrl(file.id);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function move(delta: number) {
    setIndex((current) =>
      Math.max(0, Math.min(photos.length - 1, current + delta)),
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 bg-black/95 p-0 text-white sm:max-w-none"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (trigger.isConnected) trigger.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pt-[max(.5rem,env(safe-area-inset-top))] pb-2">
          <DialogTitle className="flex-1 text-sm" aria-live="polite">
            Photo {index + 1} of {photos.length}
          </DialogTitle>
          {photo.url && (
            <Button asChild variant="ghost" size="icon" className="size-11">
              <a
                href={photo.url}
                download={`batgram-${file.id}.webp`}
                aria-label="Download photo"
              >
                <Download />
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Close gallery"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            touchStart.current =
              event.touches.length === 1
                ? { x: touch.clientX, y: touch.clientY }
                : null;
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            touchStart.current = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            if (
              Math.abs(dx) > 45 &&
              Math.abs(dx) > Math.abs(touch.clientY - start.y)
            )
              move(dx > 0 ? -1 : 1);
          }}
          onTouchCancel={() => {
            touchStart.current = null;
          }}
        >
          {photo.url ? (
            <img
              src={photo.url}
              alt={`Photo ${index + 1}`}
              draggable={false}
              className="block max-h-full max-w-full object-contain"
            />
          ) : photo.isError ? (
            <Button variant="secondary" onClick={() => void photo.refetch()}>
              Retry photo
            </Button>
          ) : (
            <p role="status">Loading photo…</p>
          )}
        </div>
        {photos.length > 1 && (
          <div className="flex shrink-0 justify-center gap-4 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Previous photo"
              disabled={index === 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Next photo"
              disabled={index === photos.length - 1}
              onClick={() => move(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
