import { useState, type ReactNode } from "react";
import type { MediaFile } from "@/features/uploads/api";
import { Button } from "@/shared/ui/button";

const pageSize = 20;

export function MessageAttachmentList({
  files,
  children,
}: {
  files?: MediaFile[];
  children: (file: MediaFile) => ReactNode;
}) {
  const [visible, setVisible] = useState(pageSize);
  if (!files?.length) return null;
  const remaining = files.length - visible;
  return (
    <>
      {files.slice(0, visible).map(children)}
      {remaining > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVisible((count) => count + pageSize)}
        >
          Show {Math.min(pageSize, remaining)} more attachments ({remaining} remaining)
        </Button>
      )}
    </>
  );
}
