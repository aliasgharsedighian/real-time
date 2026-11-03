import { useFileUrl } from "@/features/uploads/Media";
import { cn } from "@/shared/lib/utils";

export function IdentityAvatar({
  name,
  avatarId,
  className,
}: {
  name: string;
  avatarId?: string | null;
  className?: string;
}) {
  const media = useFileUrl(avatarId);
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
      {media.url ? (
        <img
          src={media.url}
          alt=""
          className="size-full rounded-full object-cover"
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
