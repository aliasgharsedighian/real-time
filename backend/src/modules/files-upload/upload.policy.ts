import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { extname, resolve } from 'node:path';

export const uploadPolicy = {
  documentMaxBytes: 100 * 1024 * 1024,
  documentExtensions: [
    '.pdf',
    '.txt',
    '.csv',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.odt',
    '.ods',
    '.odp',
    '.rtf',
    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.gz',
  ],
  avatarMaxBytes: 5 * 1024 * 1024,
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  videoMaxSeconds: 300,
  audioMaxBytes: 20 * 1024 * 1024,
  audioMaxSeconds: 300,
  musicMaxSeconds: 600,
  audioMimeTypes: [
    'audio/webm',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
  ],
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  videoMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
};
export function validateUploadFormat(
  mime: string,
  avatar: boolean,
  music: boolean,
) {
  const image = uploadPolicy.imageMimeTypes.includes(mime);
  const video = uploadPolicy.videoMimeTypes.includes(mime);
  const audio = uploadPolicy.audioMimeTypes.includes(mime);
  if ((!image && !video && !audio) || (avatar && !image) || (music && !audio))
    throw new BadRequestException('Unsupported file type.');
  return { image, audio };
}

export function validateDocumentFormat(filename: string) {
  if (
    !uploadPolicy.documentExtensions.includes(extname(filename).toLowerCase())
  )
    throw new BadRequestException('Unsupported document extension.');
}

export function validateUploadSize(size: number, max: number) {
  if (!size || size > max)
    throw new BadRequestException(
      `File must be between 1 byte and ${max / 1024 / 1024} MB.`,
    );
}

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
  title: true,
  artist: true,
} as const;

export const maxAlbumPhotos = 10;
export const messageAttachments = {
  select: fileSelect,
  orderBy: [{ position: 'asc' }, { id: 'asc' }],
} satisfies Prisma.UploadFileFindManyArgs;
