import fs from "node:fs";
import path from "node:path";
import { runProcess } from "./runProcess.js";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { MediaEngineError } from "./errors.js";

export interface ThumbnailOptions {
  /** Seconds into the clip to grab the frame from. Clamped to 0 if the clip is shorter. */
  atSeconds?: number;
  maxWidth?: number;
  ffmpegOverridePath?: string;
}

/**
 * Extracts a single frame as a JPEG thumbnail. Throws
 * MediaEngineError(FFMPEG_NOT_FOUND) up front rather than letting the
 * caller's import flow silently produce no thumbnail with no explanation.
 */
export async function generateVideoThumbnail(
  sourcePath: string,
  outputPath: string,
  options: ThumbnailOptions = {},
): Promise<void> {
  const { ffmpegPath } = locateFfmpeg(options.ffmpegOverridePath);
  if (!ffmpegPath) {
    throw new MediaEngineError("ffmpeg is not available; cannot generate a video thumbnail.", "FFMPEG_NOT_FOUND");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const atSeconds = Math.max(0, options.atSeconds ?? 1);
  const maxWidth = options.maxWidth ?? 480;

  try {
    await runProcess(ffmpegPath, [
      "-y",
      "-ss",
      String(atSeconds),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-vf",
      `scale=${maxWidth}:-1`,
      outputPath,
    ]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to generate a thumbnail for ${sourcePath}`, "THUMBNAIL_FAILED", cause);
  }
}
