import fs from "node:fs";
import bundledFfmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

export interface FfmpegLocation {
  ffmpegPath: string | null;
  ffprobePath: string | null;
}

/**
 * Resolves the ffmpeg/ffprobe binaries to use, in priority order:
 * 1. An explicit override (Settings > Advanced > FFmpeg path) for ffmpeg itself.
 * 2. The binaries bundled via ffmpeg-static / ffprobe-static.
 *
 * Never throws -- callers get `null` for whichever binary isn't available
 * and are expected to handle that (spec requires a clear "missing FFmpeg"
 * error, not a crash).
 */
export function locateFfmpeg(overridePath?: string): FfmpegLocation {
  let ffmpegPath: string | null = null;
  if (overridePath && fs.existsSync(overridePath)) {
    ffmpegPath = overridePath;
  } else if (typeof bundledFfmpegPath === "string" && fs.existsSync(bundledFfmpegPath)) {
    ffmpegPath = bundledFfmpegPath;
  }

  let ffprobePath: string | null = null;
  if (ffprobeStatic?.path && fs.existsSync(ffprobeStatic.path)) {
    ffprobePath = ffprobeStatic.path;
  }

  return { ffmpegPath, ffprobePath };
}
