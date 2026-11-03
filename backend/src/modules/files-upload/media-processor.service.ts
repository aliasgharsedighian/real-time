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
    width?: number;
    height?: number;
    disposition?: { attached_pic?: number };
  }[];
  format?: { duration?: string; size?: string };
}
const run = promisify(execFile);

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
