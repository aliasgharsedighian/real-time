import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Button } from "@/shared/ui/button";
import { api, errorMessage } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";
import { LocalPreview } from "@/features/uploads/Media";
import {
  uploadFile,
  useUploadPolicy,
  validateUpload,
} from "@/features/uploads/api";
import { chatKeys } from "../api";
import type { ChatDetails, Chat, History } from "../types";

export function GroupPhotoEditor({
  chat,
  canEdit,
}: {
  chat: ChatDetails;
  canEdit: boolean;
}) {
  const policy = useUploadPolicy();
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const cache = useQueryClient();
  const [file, setFile] = useState<File>();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function save(remove = false) {
    if (pending || !canEdit || (!remove && !file)) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setProgress(0);
    setError("");
    try {
      const path = `files/groups/${chat.id}/avatar`;
      const updated = remove
        ? (await api.delete<ChatDetails>(path, { signal: controller.signal }))
            .data
        : await uploadFile<ChatDetails>(
            path,
            file!,
            controller.signal,
            setProgress,
          );
      if (
        controller.signal.aborted ||
        useSessionStore.getState().tokens?.refreshToken !== identity
      )
        return;
      cache.setQueryData<History>(chatKeys.history(identity, chat.id), (old) =>
        old?.chat
          ? { ...old, chat: { ...old.chat, avatarId: updated.avatarId } }
          : old,
      );
      cache.setQueryData<Chat[]>(chatKeys.list(identity), (old) =>
        old?.map((c) =>
          c.id === chat.id ? { ...c, avatarId: updated.avatarId } : c,
        ),
      );
      void cache.invalidateQueries({
        queryKey: chatKeys.history(identity, chat.id),
      });
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
      setFile(undefined);
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted/40 p-4">
      {file && canEdit ? (
        <LocalPreview file={file} />
      ) : (
        <IdentityAvatar
          name={chat.name || "Group"}
          avatarId={chat.avatarId}
          className="size-20 text-2xl"
        />
      )}
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            className="sr-only"
            aria-label="Choose group photo"
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
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !policy.data}
              onClick={() => input.current?.click()}
            >
              <Camera />
              {chat.avatarId ? "Change photo" : "Add group photo"}
            </Button>
            {file && (
              <>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => void save()}
                >
                  Save photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setFile(undefined);
                    setError("");
                  }}
                >
                  Discard
                </Button>
              </>
            )}
            {chat.avatarId && !file && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void save(true)}
              >
                Remove photo
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            JPEG, PNG or WebP · up to{" "}
            {policy.data ? policy.data.avatarMaxBytes / 1024 / 1024 : "…"} MB
          </p>
          {pending && (
            <div
              role="status"
              className="w-full text-center text-xs text-muted-foreground"
            >
              <progress
                className="w-full"
                value={progress}
                max={100}
                aria-label="Group photo upload progress"
              />
              <p>
                {progress < 100
                  ? `Uploading… ${progress}%`
                  : "Optimizing and saving photo…"}
              </p>
            </div>
          )}
          {policy.isError && (
            <Button variant="link" onClick={() => void policy.refetch()}>
              Retry loading photo settings
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
