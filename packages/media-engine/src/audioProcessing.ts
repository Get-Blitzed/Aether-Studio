import fs from "node:fs";
import path from "node:path";
import { runProcess } from "./runProcess.js";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { MediaEngineError } from "./errors.js";

function requireFfmpeg(overridePath?: string): string {
  const { ffmpegPath } = locateFfmpeg(overridePath);
  if (!ffmpegPath) {
    throw new MediaEngineError("ffmpeg is not available; cannot process audio.", "FFMPEG_NOT_FOUND");
  }
  return ffmpegPath;
}

function ensureOutputDir(outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

/** Trims to [startSeconds, endSeconds). Re-encodes (no -c copy) for sample-accurate cuts on any input format. */
export async function trimAudio(
  sourcePath: string,
  outputPath: string,
  startSeconds: number,
  endSeconds: number,
  ffmpegOverridePath?: string,
): Promise<void> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  try {
    await runProcess(ffmpegPath, [
      "-y",
      "-i",
      sourcePath,
      "-ss",
      String(startSeconds),
      "-to",
      String(endSeconds),
      outputPath,
    ]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to trim ${sourcePath}`, "TRIM_FAILED", cause);
  }
}

/** EBU R128 loudness normalization (single-pass loudnorm; good enough for narration leveling). */
export async function normalizeLoudness(
  sourcePath: string,
  outputPath: string,
  targetLufs = -16,
  ffmpegOverridePath?: string,
): Promise<void> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  try {
    await runProcess(ffmpegPath, [
      "-y",
      "-i",
      sourcePath,
      "-af",
      `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`,
      outputPath,
    ]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to normalize loudness for ${sourcePath}`, "NORMALIZE_FAILED", cause);
  }
}

/** FFT-based noise reduction (afftdn) -- a general-purpose denoiser, not tuned per-recording. */
export async function denoiseAudio(sourcePath: string, outputPath: string, ffmpegOverridePath?: string): Promise<void> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  try {
    await runProcess(ffmpegPath, ["-y", "-i", sourcePath, "-af", "afftdn", outputPath]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to denoise ${sourcePath}`, "DENOISE_FAILED", cause);
  }
}

export interface SilenceRemovalOptions {
  thresholdDb?: number;
  minSilenceSeconds?: number;
  ffmpegOverridePath?: string;
}

/** Strips leading/trailing/internal silence below a threshold. */
export async function removeSilence(
  sourcePath: string,
  outputPath: string,
  options: SilenceRemovalOptions = {},
): Promise<void> {
  const ffmpegPath = requireFfmpeg(options.ffmpegOverridePath);
  ensureOutputDir(outputPath);
  const thresholdDb = options.thresholdDb ?? -50;
  const minSilence = options.minSilenceSeconds ?? 0.3;
  const filter = `silenceremove=start_periods=1:start_threshold=${thresholdDb}dB:start_silence=${minSilence}:stop_periods=-1:stop_threshold=${thresholdDb}dB:stop_silence=${minSilence}`;
  try {
    await runProcess(ffmpegPath, ["-y", "-i", sourcePath, "-af", filter, outputPath]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to remove silence from ${sourcePath}`, "SILENCE_REMOVAL_FAILED", cause);
  }
}

/** Concatenates takes in order via the concat filter (re-encodes, so mismatched input formats are fine). */
export async function mergeAudioTakes(
  sourcePaths: string[],
  outputPath: string,
  ffmpegOverridePath?: string,
): Promise<void> {
  if (sourcePaths.length < 2) {
    throw new MediaEngineError("Merging requires at least two takes.", "MERGE_FAILED");
  }
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  const inputArgs = sourcePaths.flatMap((p) => ["-i", p]);
  const streamRefs = sourcePaths.map((_, i) => `[${i}:a]`).join("");
  const filter = `${streamRefs}concat=n=${sourcePaths.length}:v=0:a=1[out]`;
  try {
    await runProcess(ffmpegPath, ["-y", ...inputArgs, "-filter_complex", filter, "-map", "[out]", outputPath]);
  } catch (cause) {
    throw new MediaEngineError("Failed to merge takes", "MERGE_FAILED", cause);
  }
}

export type AudioExportFormat = "wav" | "mp3";

/** Converts to WAV (pcm_s16le) or MP3 (libmp3lame, 192kbps) for delivery. */
export async function convertAudioFormat(
  sourcePath: string,
  outputPath: string,
  format: AudioExportFormat,
  ffmpegOverridePath?: string,
): Promise<void> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  ensureOutputDir(outputPath);
  const codecArgs = format === "wav" ? ["-c:a", "pcm_s16le"] : ["-c:a", "libmp3lame", "-b:a", "192k"];
  try {
    await runProcess(ffmpegPath, ["-y", "-i", sourcePath, ...codecArgs, outputPath]);
  } catch (cause) {
    throw new MediaEngineError(`Failed to convert ${sourcePath} to ${format}`, "CONVERT_FAILED", cause);
  }
}

export interface LoudnessAnalysis {
  integratedLufs?: number;
  loudnessRangeLu?: number;
  truePeakDbfs?: number;
}

/** Runs the ebur128 filter and parses its stderr summary -- ffmpeg has no JSON output mode for this. */
export async function analyzeLoudness(filePath: string, ffmpegOverridePath?: string): Promise<LoudnessAnalysis> {
  const ffmpegPath = requireFfmpeg(ffmpegOverridePath);
  let stderr: string;
  try {
    const result = await runProcess(ffmpegPath, [
      "-i",
      filePath,
      "-af",
      "ebur128=peak=true",
      "-f",
      "null",
      "-",
    ]);
    stderr = result.stderr;
  } catch (error) {
    // execFile rejects with the error object augmented with stdout/stderr (see runProcess.ts);
    // ffmpeg writes filter output to stderr even on a "successful" pass with -f null, but a
    // genuinely bad file makes ffmpeg exit non-zero, landing here instead.
    const withOutput = error as { stderr?: string };
    stderr = withOutput.stderr ?? "";
    if (!stderr.includes("Integrated loudness")) {
      throw new MediaEngineError(`Failed to analyze loudness for ${filePath}`, "LOUDNESS_ANALYSIS_FAILED", error);
    }
  }

  // ffmpeg prints one "I: ... LUFS" progress line per ~100ms of playback
  // *while measuring*, then a final "Summary:" block with the converged
  // values. Matching the first "I:" anywhere in stderr grabs an early,
  // unstable transient reading instead of the real result -- restrict
  // parsing to the text after "Summary:" specifically.
  const summaryIndex = stderr.lastIndexOf("Summary:");
  const summaryText = summaryIndex >= 0 ? stderr.slice(summaryIndex) : stderr;

  const integrated = /Integrated loudness:[\s\S]*?I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/.exec(summaryText);
  const range = /LRA:\s*(-?\d+(?:\.\d+)?)\s*LU\b/.exec(summaryText);
  const peak = /Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/.exec(summaryText);

  return {
    integratedLufs: integrated ? Number.parseFloat(integrated[1]!) : undefined,
    loudnessRangeLu: range ? Number.parseFloat(range[1]!) : undefined,
    truePeakDbfs: peak ? Number.parseFloat(peak[1]!) : undefined,
  };
}
