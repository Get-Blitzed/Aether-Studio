export class ExportEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FFMPEG_NOT_FOUND"
      | "NO_VIDEO_SEGMENTS"
      | "RENDER_FAILED"
      | "ARCHIVE_FAILED",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExportEngineError";
  }
}
