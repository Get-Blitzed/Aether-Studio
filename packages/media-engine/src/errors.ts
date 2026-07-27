export class MediaEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FFMPEG_NOT_FOUND"
      | "FFPROBE_NOT_FOUND"
      | "PROBE_FAILED"
      | "THUMBNAIL_FAILED"
      | "WAVEFORM_FAILED"
      | "UNSUPPORTED_FILE",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MediaEngineError";
  }
}
