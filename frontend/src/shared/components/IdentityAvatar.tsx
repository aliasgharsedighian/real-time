import { cn } from "@/shared/lib/utils";

export function IdentityAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold uppercase text-brand",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}
