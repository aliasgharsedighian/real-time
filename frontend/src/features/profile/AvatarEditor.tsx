import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSessionStore } from "@/features/auth/session-store";
import { api, errorMessage } from "@/shared/lib/api";
import type { Profile, User } from "@/shared/lib/types";
import { Button } from "@/shared/ui/button";
import { LocalPreview } from "@/features/uploads/Media";
import {
  uploadFile,
  useUploadPolicy,
  validateUpload,
} from "@/features/uploads/api";

export function AvatarEditor({ hasAvatar }: { hasAvatar: boolean }) {
  const policy = useUploadPolicy();
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const cache = useQueryClient();
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function save(remove = false) {
    if (!remove && (!file || !policy.data)) return;
    setPending(true);
    setError("");
    setProgress(0);
    const request = new AbortController();
    try {
      const profile = remove
        ? (
            await api.delete<Profile>("files/avatar", {
              signal: request.signal,
            })
          ).data
        : await uploadFile<Profile>(
            "files/avatar",
            file!,
            request.signal,
            setProgress,
          );
      if (useSessionStore.getState().tokens?.refreshToken !== identity) return;
      cache.setQueryData<User>(["session", identity], (old) =>
        old ? { ...old, profile } : old,
      );
      void cache.invalidateQueries({ queryKey: ["chats", identity] });
      setFile(undefined);
      toast.success(remove ? "Profile photo removed" : "Profile photo updated");
    } catch (error) {
      if (!request.signal.aborted) setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="w-full max-w-sm space-y-3 text-center">
      <input
        ref={input}
        type="file"
        aria-label="Choose profile photo"
        className="sr-only"
        accept={policy.data?.imageMimeTypes.join(",")}
        disabled={pending || !policy.data}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = "";
          if (!chosen || !policy.data) return;
          try {
            validateUpload(chosen, policy.data, true);
            setFile(chosen);
            setError("");
          } catch (error) {
            setError(errorMessage(error));
          }
        }}
      />
      {file && (
        <div className="flex justify-center">
          <LocalPreview file={file} />
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          disabled={pending || !policy.data}
          onClick={() => input.current?.click()}
        >
          Choose photo
        </Button>
        {file && (
          <>
            <Button disabled={pending} onClick={() => void save()}>
              Save photo
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setFile(undefined)}
            >
              Discard
            </Button>
          </>
        )}
        {hasAvatar && !file && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => void save(true)}
          >
            Remove photo
          </Button>
        )}
      </div>
      {pending && (
        <p role="status" className="text-xs text-muted-foreground">
          {progress < 100
            ? `Uploading… ${progress}%`
            : "Optimizing and saving photo…"}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG or WebP · up to{" "}
        {policy.data ? policy.data.avatarMaxBytes / 1024 / 1024 : "…"} MB
      </p>
      {policy.isError && (
        <Button variant="link" onClick={() => void policy.refetch()}>
          Retry loading upload settings
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
