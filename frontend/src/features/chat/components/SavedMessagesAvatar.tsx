import { Bookmark } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function SavedMessagesAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white",
        className,
      )}
    >
      <Bookmark className="size-5 fill-current" />
    </span>
  );
}
