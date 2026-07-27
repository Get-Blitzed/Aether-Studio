import { runProcess } from "./runProcess.js";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { MediaEngineError } from "./errors.js";

export interface ProbeResult {
  durationSeconds?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  formatName?: string;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
}

interface FfprobeJson {
  format?: { duration?: string; format_name?: string };
  streams?: FfprobeStream[];
}

/**
 * Runs ffprobe -show_format -show_streams -of json against a media file.
 * Throws MediaEngineError(FFPROBE_NOT_FOUND) if no ffprobe binary is
 * available, and MediaEngineError(PROBE_FAILED) if ffprobe itself errors
 * (e.g. an unreadable or non-media file) -- callers should treat both as
 * "no metadata available," not a fatal error for the whole import.
 */
export async function probeMedia(filePath: string, ffmpegOverridePath?: string): Promise<ProbeResult> {
  const { ffprobePath } = locateFfmpeg(ffmpegOverridePath);
  if (!ffprobePath) {
    throw new MediaEngineError(
      "ffprobe is not available. Media metadata (duration, resolution) cannot be read.",
      "FFPROBE_NOT_FOUND",
    );
  }

  let stdout: string;
  try {
    const result = await runProcess(ffprobePath, [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      filePath,
    ]);
    stdout = result.stdout;
  } catch (cause) {
    throw new MediaEngineError(`ffprobe failed to read ${filePath}`, "PROBE_FAILED", cause);
  }

  let parsed: FfprobeJson;
  try {
    parsed = JSON.parse(stdout);
  } catch (cause) {
    throw new MediaEngineError(`ffprobe returned invalid JSON for ${filePath}`, "PROBE_FAILED", cause);
  }

  const videoStream = parsed.streams?.find((s) => s.codec_type === "video");
  const audioStream = parsed.streams?.find((s) => s.codec_type === "audio");
  const durationRaw = parsed.format?.duration;

  return {
    durationSeconds: durationRaw ? Number.parseFloat(durationRaw) : undefined,
    width: videoStream?.width,
    height: videoStream?.height,
    videoCodec: videoStream?.codec_name,
    audioCodec: audioStream?.codec_name,
    formatName: parsed.format?.format_name,
  };
}
