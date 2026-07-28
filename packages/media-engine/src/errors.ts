export class MediaEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FFMPEG_NOT_FOUND"
      | "FFPROBE_NOT_FOUND"
      | "PROBE_FAILED"
      | "THUMBNAIL_FAILED"
      | "WAVEFORM_FAILED"
      | "UNSUPPORTED_FILE"
      | "TRIM_FAILED"
      | "NORMALIZE_FAILED"
      | "DENOISE_FAILED"
      | "SILENCE_REMOVAL_FAILED"
      | "MERGE_FAILED"
      | "CONVERT_FAILED"
      | "LOUDNESS_ANALYSIS_FAILED"
      | "VIDEO_TRIM_FAILED"
      | "VIDEO_SPEED_FAILED"
      | "IMAGE_TO_VIDEO_FAILED",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MediaEngineError";
  }
}
