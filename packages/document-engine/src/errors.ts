export class DocumentEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNSUPPORTED_FILE_TYPE"
      | "EXTRACTION_FAILED"
      | "SLIDE_RENDER_FAILED"
      | "FFMPEG_NOT_FOUND",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DocumentEngineError";
  }
}
