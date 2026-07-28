export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "OFFLINE_MODE_BLOCKED"
      | "INVALID_CONFIG"
      | "NOT_SUPPORTED"
      | "MISSING_SECRET"
      | "NETWORK_ERROR"
      | "REQUEST_FAILED"
      | "IMAGE_GENERATION_FAILED"
      | "VOICE_SYNTHESIS_FAILED"
      | "VOICE_LIST_FAILED",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
