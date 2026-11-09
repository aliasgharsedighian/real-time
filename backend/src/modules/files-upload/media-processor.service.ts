import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { uploadPolicy } from './upload.policy';
import * as ffmpegModule from 'ffmpeg-static';
// The package exposes a CommonJS string while its declarations use a default export.
const ffmpegPath = ffmpegModule as unknown as string | null;
import * as ffprobe from '@ffprobe-installer/ffprobe';

interface ProbeResult {
  streams?: {
    codec_type?: string;
    tags?: Record<string, unknown>;
    width?: number;
    height?: number;
    disposition?: { attached_pic?: number };
  }[];
  format?: { duration?: string; size?: string; tags?: Record<string, unknown> };
}
const run = promisify(execFile);

function audioLabel(value: unknown) {
  if (typeof value !== 'string') return null;
  return (
    Array.from(
      value
        .replace(/\s+/g, ' ')
        .replace(/\p{Cc}/gu, '')
        .trim(),
    )
      .slice(0, 200)
      .join('') || null
  );
}

@Injectable()
export class MediaProcessorService {
  async image(input: string, output: string, avatar: boolean) {
    try {
      const image = sharp(input, {
        limitInputPixels: 40_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
        (metadata.pages || 1) > 1
      )
        throw new Error('Unsupported image');
      const info = await image
        .rotate()
        .resize(avatar ? 512 : 1920, avatar ? 512 : 1920, {
          fit: avatar ? 'cover' : 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80, effort: 4 })
        .timeout({ seconds: 30 })
        .toFile(output);
      return {
        kind: 'IMAGE',
        mimeType: 'image/webp',
        size: info.size,
        width: info.width,
        height: info.height,
      };
    } catch {
      throw new BadRequestException(
        'Invalid image. Use a non-animated JPEG, PNG or WebP (up to 40 megapixels).',
      );
    }
  }

  async audio(input: string, output: string, musicFilename?: string) {
    const music = musicFilename !== undefined;
    const maxSeconds = music
      ? uploadPolicy.musicMaxSeconds
      : uploadPolicy.audioMaxSeconds;
    try {
      const handle = await import('node:fs/promises').then((fs) =>
        fs.open(input, 'r'),
      );
      const header = Buffer.alloc(16);
      try {
        await handle.read(header, 0, 16, 0);
      } finally {
        await handle.close();
      }
      const supported =
        header.toString('ascii', 4, 8) === 'ftyp' ||
        header.readUInt32BE(0) === 0x1a45dfa3 ||
        header.toString('ascii', 0, 4) === 'OggS' ||
        (header.toString('ascii', 0, 4) === 'RIFF' &&
          header.toString('ascii', 8, 12) === 'WAVE') ||
        header.toString('ascii', 0, 3) === 'ID3' ||
        (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
      if (!supported) throw new Error('Unsupported audio container');
      const probe = async (path: string) => {
        const { stdout } = await run(
          process.env.FFPROBE_PATH || ffprobe.path,
          [
            '-v',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-show_streams',
            '-show_format',
            '-of',
            'json',
            path,
          ],
          { timeout: 15_000, maxBuffer: 1024 * 1024 },
        );
        return JSON.parse(stdout) as ProbeResult;
      };
      const source = await probe(input);
      const audioStream = source.streams?.find(
        (stream) => stream.codec_type === 'audio',
      );
      if (
        !audioStream ||
        source.streams?.some(
          (s) => s.codec_type === 'video' && !s.disposition?.attached_pic,
        )
      )
        throw new Error('Expected audio only');
      // MediaRecorder WebM may have no duration until decoded. Bound decoding and verify the output.
      const sourceDuration = Number(source.format?.duration);
      if (Number.isFinite(sourceDuration) && sourceDuration > maxSeconds)
        throw new Error('Audio too long');
      await run(
        process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg',
        [
          '-nostdin',
          '-v',
          'error',
          '-y',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '2',
          '-i',
          input,
          '-map',
          '0:a:0',
          '-vn',
          '-map_metadata',
          '-1',
          '-map_chapters',
          '-1',
          '-t',
          String(maxSeconds + 1),
          '-c:a',
          'aac',
          '-b:a',
          music ? '160k' : '96k',
          '-ac',
          music ? '2' : '1',
          '-movflags',
          '+faststart',
          '-fs',
          String(uploadPolicy.audioMaxBytes),
          output,
        ],
        { timeout: 120_000, maxBuffer: 1024 * 1024 },
      );
      const result = await probe(output);
      const duration = Number(result.format?.duration);
      const size = Number(result.format?.size);
      if (
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > maxSeconds ||
        !Number.isFinite(size) ||
        size <= 0 ||
        size > uploadPolicy.audioMaxBytes ||
        (Number.isFinite(sourceDuration) &&
          Math.abs(sourceDuration - duration) > 1)
      )
        throw new Error('Invalid audio duration or size');
      const tags = Object.fromEntries(
        Object.entries({
          ...audioStream.tags,
          ...source.format?.tags,
        }).map(([key, value]) => [key.toLowerCase(), value]),
      );
      const filename = musicFilename ?? '';
      // Multer's multipart parser decodes UTF-8 filenames as Latin-1.
      const decoded = Buffer.from(filename, 'latin1').toString('utf8');
      const fallback = decoded.includes('�') ? filename : decoded;
      return {
        kind: music ? 'MUSIC' : 'AUDIO',
        ...(music && {
          title:
            audioLabel(tags.title) ??
            audioLabel(fallback.replace(/\.[^.]+$/, '')) ??
            'Music',
          artist: audioLabel(tags.artist) ?? audioLabel(tags.album_artist),
        }),
        mimeType: 'audio/mp4',
        size,
        width: 0,
        height: 0,
        duration,
      };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw new ServiceUnavailableException(
          'Audio processing is unavailable.',
        );
      throw new BadRequestException(
        `Invalid audio. Use WebM, M4A, Ogg, MP3 or WAV, up to ${maxSeconds / 60} minutes.`,
      );
    }
  }

  async video(input: string, output: string) {
    try {
      // Inspect actual container magic before invoking the decoder. Never permit playlists/URLs.
      const handle = await import('node:fs/promises').then((fs) =>
        fs.open(input, 'r'),
      );
      const header = Buffer.alloc(16);
      try {
        await handle.read(header, 0, 16, 0);
      } finally {
        await handle.close();
      }
      if (
        header.toString('ascii', 4, 8) !== 'ftyp' &&
        header.readUInt32BE(0) !== 0x1a45dfa3
      )
        throw new Error('Unsupported container');
      const { stdout } = await run(
        process.env.FFPROBE_PATH || ffprobe.path,
        [
          '-v',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          input,
        ],
        { timeout: 15_000, maxBuffer: 1024 * 1024 },
      );
      const metadata = JSON.parse(stdout) as ProbeResult;
      const stream = metadata.streams?.find(
        (s) => s.codec_type === 'video' && !s.disposition?.attached_pic,
      );
      const duration = Number(metadata.format?.duration);
      if (
        !stream ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > uploadPolicy.videoMaxSeconds ||
        !stream.width ||
        !stream.height ||
        stream.width * stream.height > 3840 * 2160
      )
        throw new Error('Invalid duration or dimensions');
      await run(
        process.env.FFMPEG_PATH || ffmpegPath || 'ffmpeg',
        [
          '-nostdin',
          '-v',
          'error',
          '-y',
          '-protocol_whitelist',
          'file,pipe',
          '-threads',
          '2',
          '-i',
          input,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-map_metadata',
          '-1',
          '-map_chapters',
          '-1',
          '-vf',
          "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '28',
          '-pix_fmt',
          'yuv420p',
          '-threads',
          '2',
          '-r',
          '30',
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-movflags',
          '+faststart',
          '-fs',
          String(uploadPolicy.videoMaxBytes),
          output,
        ],
        { timeout: 180_000, maxBuffer: 1024 * 1024 },
      );
      const { stdout: encoded } = await run(
        process.env.FFPROBE_PATH || ffprobe.path,
        ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output],
        { timeout: 15_000 },
      );
      const result = JSON.parse(encoded) as ProbeResult;
      const video = result.streams?.find((s) => s.codec_type === 'video');
      if (
        !video?.width ||
        !video.height ||
        !Number.isFinite(Number(result.format?.duration)) ||
        Math.abs(Number(result.format?.duration) - duration) > 1
      )
        throw new Error('Incomplete video');
      return {
        kind: 'VIDEO',
        mimeType: 'video/mp4',
        size: Number(result.format?.size),
        width: video.width,
        height: video.height,
        duration: Number(result.format?.duration),
      };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw new ServiceUnavailableException(
          'Video processing is unavailable.',
        );
      throw new BadRequestException(
        'Invalid video. Use MP4, WebM or MOV, up to 5 minutes and 4K.',
      );
    }
  }
}
