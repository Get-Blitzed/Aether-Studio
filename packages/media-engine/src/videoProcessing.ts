import fs from "node:fs";
import path from "node:path";
import { runProcess } from "./runProcess.js";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { MediaEngineError } from "./errors.js";

function requireFfmpeg(overridePath?: string): string {
  const { ffmpegPath } = locateFfmpeg(overridePath);
  if (!ffmpegPath) {
    throw new MediaEngineError("ffmpeg is not available; cannot process video.", "FFMPEG_NOT_FOUND");
  }
  return ffmpegPath;
}

function ensureOutputDir(outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

/** Trims to [startSeconds, endSeconds), re-encoding both streams for a sample-accurate cut. */
export async function trimVideo(
  sourcePath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number,
  ffmpegOverridePath?: string,
): Promise<void> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  try {
    await runProcess(
      ffmpegPath,
      ["-y", "-i", sourcePath, "-ss", String(startSeconds), "-to", String(endSeconds), "-c:v", "libx264", "-c:a", "aac", outputPath],
      60_000,
    );
  } catch (cause) {
    throw new MediaEngineError(`Failed to trim ${sourcePath}`, "VIDEO_TRIM_FAILED", cause);
  }
}

/**
 * Speeds up or slows down both video and audio in lockstep. The `atempo`
 * filter only accepts 0.5-2.0 in a single stage, so factor is clamped to
 * that range -- outside it would need chained atempo stages, not needed for
 * the "speed adjustment" use case this serves (reviewing/condensing a demo
 * clip, not extreme time-lapse).
 */
export async function adjustVideoSpeed(
  sourcePath: string,
  outputPath: string,
  speedFactor: number,
  ffmpegOverridePath?: string,
): Promise<void> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  const clamped = Math.min(2, Math.max(0.5, speedFactor));
  const filter = `[0:v]setpts=${1 / clamped}*PTS[v];[0:a]atempo=${clamped}[a]`;
  try {
    await runProcess(
      ffmpegPath,
      ["-y", "-i", sourcePath, "-filter_complex", filter, "-map", "[v]", "-map", "[a]", outputPath],
      60_000,
    );
  } catch (cause) {
    throw new MediaEngineError(`Failed to adjust playback speed for ${sourcePath}`, "VIDEO_SPEED_FAILED", cause);
  }
}
