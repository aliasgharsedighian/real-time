import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";

export interface MediaFile {
  id: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO";
  mimeType: string;
  size: number;
  width: number;
  height: number;
  duration?: number | null;
}
export interface UploadPolicy {
  avatarMaxBytes: number;
  imageMaxBytes: number;
  videoMaxBytes: number;
  videoMaxSeconds: number;
  audioMaxBytes: number;
  audioMaxSeconds: number;
  audioMimeTypes: string[];
  imageMimeTypes: string[];
  videoMimeTypes: string[];
}
export function useUploadPolicy() {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  return useQuery({
    queryKey: ["upload-policy", identity],
    queryFn: async () => (await api.get<UploadPolicy>("files/policy")).data,
    staleTime: 5 * 60_000,
  });
}
export function validateUpload(
  file: File,
  policy: UploadPolicy,
  avatar = false,
) {
  const mime = file.type.split(";")[0];
  const image = policy.imageMimeTypes.includes(mime);
  const audio = policy.audioMimeTypes?.includes(mime);
  if (!image && (avatar || (!policy.videoMimeTypes.includes(mime) && !audio)))
    throw new Error(
      avatar
        ? "Choose a JPEG, PNG or WebP image."
        : "Choose a JPEG, PNG, WebP, MP4, WebM, MOV or audio file.",
    );
  const max = avatar
    ? policy.avatarMaxBytes
    : image
      ? policy.imageMaxBytes
      : audio
        ? policy.audioMaxBytes
        : policy.videoMaxBytes;
  if (!file.size || file.size > max)
    throw new Error(`File must be between 1 byte and ${max / 1024 / 1024} MB.`);
}
export async function uploadFile<T>(
  path: string,
  file: File,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<T>(path, form, {
    signal,
    timeout: 240_000,
    onUploadProgress: (event) => {
      if (event.total) progress(Math.round((event.loaded / event.total) * 100));
    },
  });
  return response.data;
}
export async function discardFile(id: string) {
  await api.delete(`files/${id}`);
}
