import { LoaderCircle } from "lucide-react";
import { Brand } from "./Brand";

export function BrandLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      role="status"
      className="brand-scene grid min-h-[60dvh] flex-1 place-items-center p-6"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <Brand
          variant="vertical"
          className="w-56 shadow-[0_0_60px_var(--brand-halo)]"
        />
        <LoaderCircle
          className="size-7 animate-spin text-brand"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
