export interface JobUsageEstimate {
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

export interface TextGenerationRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface TextGenerationResult {
  text: string;
  usage: JobUsageEstimate;
}

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  /** Absolute path to a generated image file on disk, owned by the caller to move/import. */
  filePath: string;
  width: number;
  height: number;
  usage: JobUsageEstimate;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

/**
 * The contract every AI provider implementation satisfies. A provider only
 * implements the capability it was configured for (text or image) --
 * `ProviderConfig.capability` determines which method the caller invokes;
 * the other is simply absent.
 */
export interface AiProvider {
  testConnection(): Promise<ConnectionTestResult>;
  generateText?(request: TextGenerationRequest): Promise<TextGenerationResult>;
  generateImage?(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
