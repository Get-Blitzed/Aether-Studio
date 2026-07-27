export class ProjectEngineError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MANIFEST_NOT_FOUND"
      | "MANIFEST_INVALID"
      | "MANIFEST_VERSION_UNSUPPORTED"
      | "PROJECT_DIR_EXISTS"
      | "BACKUP_NOT_FOUND",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProjectEngineError";
  }
}
