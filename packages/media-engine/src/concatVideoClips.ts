import fs from "node:fs";
import path from "node:path";
import { runProcess } from "./runProcess.js";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { MediaEngineError } from "./errors.js";

export interface VideoSegmentInput {
  filePath: string;
  startSeconds: number;
  endSeconds: number;
}

export interface ConcatOptions {
  width?: number;
  height?: number;
  ffmpegOverridePath?: string;
}

/**
 * Trims each segment and concatenates them into a single video, in order.
 * Video-only (no audio) -- this backs the timeline's "quick preview render"
 * for the primary video track, not a full export. Every segment is scaled
 * and letterboxed to a common resolution first so the concat filter doesn't
 * choke on mismatched source resolutions (e.g. a screen recording next to an
 * imported video asset).
 */
export async function concatVideoClips(
  segments: VideoSegmentInput[],
  outputPath: string,
  options: ConcatOptions = {},
): Promise<void> {
  if (segments.length === 0) {
    throw new MediaEngineError("At least one segment is required to render a preview.", "VIDEO_TRIM_FAILED");
  }

  const { ffmpegPath } = locateFfmpeg(options.ffmpegOverridePath);
  if (!ffmpegPath) {
    throw new MediaEngineError("ffmpeg is not available; cannot render a preview.", "FFMPEG_NOT_FOUND");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const width = options.width ?? 1280;
  const height = options.height ?? 720;

  const inputArgs = segments.flatMap((s) => ["-i", s.filePath]);
  const perClipFilters = segments.map(
    (s, i) =>
      `[${i}:v]trim=start=${s.startSeconds}:end=${s.endSeconds},setpts=PTS-STARTPTS,` +
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
  );
  const concatInputs = segments.map((_, i) => `[v${i}]`).join("");
  const filterComplex = `${perClipFilters.join(";")};${concatInputs}concat=n=${segments.length}:v=1:a=0[outv]`;

  try {
    await runProcess(
      ffmpegPath,
      ["-y", ...inputArgs, "-filter_complex", filterComplex, "-map", "[outv]", outputPath],
      120_000,
    );
  } catch (cause) {
    throw new MediaEngineError("Failed to render the timeline preview", "VIDEO_TRIM_FAILED", cause);
  }
}
