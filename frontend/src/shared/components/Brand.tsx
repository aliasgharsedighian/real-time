import { cn } from "@/shared/lib/utils";

export function Brand({
  variant = "horizontal",
  className = "",
}: {
  variant?: "horizontal" | "vertical" | "icon";
  className?: string;
}) {
  const dimensions =
    variant === "horizontal"
      ? [648, 110]
      : variant === "vertical"
        ? [383, 270]
        : [288, 284];
  return (
    <img
      src={`/brand/${variant === "icon" ? "app-icon" : `logo-${variant}`}.png`}
      alt="BatGram"
      width={dimensions[0]}
      height={dimensions[1]}
      draggable={false}
      className={cn(
        "object-contain",
        variant === "horizontal"
          ? "w-44 rounded-lg"
          : variant === "vertical"
            ? "w-64 rounded-2xl"
            : "size-12 rounded-2xl",
        className,
      )}
    />
  );
}
