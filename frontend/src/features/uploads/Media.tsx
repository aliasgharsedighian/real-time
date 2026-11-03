import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "@/features/auth/session-store";
import { api } from "@/shared/lib/api";
import { Button } from "@/shared/ui/button";
import type { MediaFile } from "./api";

// Revoke each consumer's URL on unmount/account change, while sharing authenticated Blob requests.
export function useFileUrl(id?: string | null) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const query = useQuery({
    queryKey: ["media", identity, id],
    enabled: !!id && !!identity,
    queryFn: async ({ signal }) =>
      (
        await api.get<Blob>(`files/${id}/content`, {
          signal,
          responseType: "blob",
          timeout: 120_000,
        })
      ).data,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
  });
  const [resource, setResource] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setResource({ blob: query.data, url });
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  return {
    ...query,
    url: resource?.blob === query.data ? resource?.url : undefined,
  };
}
export function Media({ file }: { file: MediaFile }) {
  const media = useFileUrl(file.id);
  if (media.isError)
    return (
      <div className="p-3 text-sm" role="alert">
        Unable to load attachment.{" "}
        <Button variant="link" onClick={() => void media.refetch()}>
          Retry
        </Button>
      </div>
    );
  if (!media.url)
    return (
      <p role="status" className="p-4 text-sm">
        Loading attachment…
      </p>
    );
  return (
    <div className="max-w-full space-y-1">
      {file.kind === "VIDEO" ? (
        <video
          src={media.url}
          controls
          preload="metadata"
          playsInline
          className="max-h-96 max-w-full rounded-xl"
        />
      ) : (
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open full image"
        >
          <img
            src={media.url}
            alt="Chat attachment"
            width={file.width}
            height={file.height}
            className="max-h-96 max-w-full rounded-xl object-contain"
          />
        </a>
      )}
      <a
        href={media.url}
        download={`batgram-${file.id}.${file.kind === "VIDEO" ? "mp4" : "webp"}`}
        className="block text-xs underline"
      >
        Download · {(file.size / 1024 / 1024).toFixed(2)} MB
      </a>
    </div>
  );
}
export function LocalPreview({ file }: { file: File }) {
  const [resource, setResource] = useState<{ file: File; url: string }>();
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setResource({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const url = resource?.file === file ? resource?.url : undefined;
  return file.type.startsWith("video/") ? (
    <video
      src={url}
      controls
      preload="metadata"
      className="max-h-40 max-w-full rounded-lg"
    />
  ) : (
    <img
      src={url}
      alt="Selected attachment preview"
      className="max-h-40 max-w-full rounded-lg object-contain"
    />
  );
}
