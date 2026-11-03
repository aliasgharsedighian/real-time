import { resolve } from 'node:path';

export const uploadPolicy = {
  avatarMaxBytes: 5 * 1024 * 1024,
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  videoMaxSeconds: 300,
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  videoMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
};
// Store relative keys in the DB; moving the entire storage needs only this setting.
export function uploadRoot() {
  return resolve(process.env.UPLOAD_DIR || 'uploads');
}
export const fileSelect = {
  id: true,
  kind: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  duration: true,
} as const;
