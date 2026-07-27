import fs from "node:fs";
import path from "node:path";
import { runProcess } from "./runProcess.js";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { MediaEngineError } from "./errors.js";

export interface WaveformOptions {
  width?: number;
  height?: number;
  colorHex?: string;
  ffmpegOverridePath?: string;
}

/** Renders a waveform PNG for an audio (or video-with-audio) file via ffmpeg's showwavespic filter. */
export async function generateWaveformImage(
  sourcePath: string,
  outputPath: string,
  options: WaveformOptions = {},
): Promise<void> {
  const { ffmpegPath } = locateFfmpeg(options.ffmpegOverridePath);
  if (!ffmpegPath) {
    throw new MediaEngineError("ffmpeg is not available; cannot generate a waveform image.", "FFMPEG_NOT_FOUND");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const width = options.width ?? 800;
  const height = options.height ?? 120;
  const color = (options.colorHex ?? "#3E8EF7").replace("#", "0x");

  try {
    await runProcess(ffmpegPath, [
      "-y",
      "-i",
      sourcePath,
      "-filter_complex",
      `showwavespic=s=${width}x${height}:colors=${color}`,
      "-frames:v",
      "1",
      outputPath,
    ]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to generate a waveform image for ${sourcePath}`, "WAVEFORM_FAILED", cause);
  }
}
