import type { ReactNode } from "react";

export function TransferProgress({
  percent,
  children,
}: {
  percent: number;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full text-[10px] tabular-nums"
      style={{
        background: `conic-gradient(var(--brand) ${percent}%, var(--border) 0)`,
      }}
    >
      <span className="grid size-9 place-items-center rounded-full bg-card text-foreground">
        {children ?? `${percent}%`}
      </span>
    </span>
  );
}

export function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}
