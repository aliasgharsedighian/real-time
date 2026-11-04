import { LoaderCircle } from "lucide-react";
import { Brand } from "./Brand";

export function BrandLoading({
  message = "Loading…",
  compact = false,
}: {
  message?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={
        compact
          ? "flex items-center justify-center gap-2 py-3"
          : "brand-scene grid min-h-[60dvh] flex-1 place-items-center p-6"
      }
    >
      <div
        className={
          compact
            ? "flex items-center gap-2"
            : "flex flex-col items-center gap-6 text-center"
        }
      >
        {!compact && (
          <Brand
            variant="vertical"
            className="w-56 shadow-[0_0_60px_var(--brand-halo)]"
          />
        )}
        <LoaderCircle
          className={`${compact ? "size-4" : "size-7"} animate-spin text-brand motion-reduce:animate-none`}
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
