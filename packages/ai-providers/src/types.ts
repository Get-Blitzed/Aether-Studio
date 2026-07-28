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

export interface VoiceOption {
  id: string;
  name: string;
  gender?: string;
  locale?: string;
}

export interface VoiceSynthesisRequest {
  text: string;
  voiceId?: string;
  /** -10 (slowest) to 10 (fastest), 0 is a natural speaking pace -- SAPI's native scale, reused as the app-wide convention. */
  rate?: number;
  /** Semitone shift applied via SSML prosody; 0 is unchanged. */
  pitchSemitones?: number;
  /** 0-100. */
  volume?: number;
}

export interface VoiceSynthesisResult {
  /** Absolute path to a generated audio file on disk, owned by the caller to move/import. */
  filePath: string;
  durationSeconds?: number;
  usage: JobUsageEstimate;
}

/**
 * The contract every AI provider implementation satisfies. A provider only
 * implements the capability it was configured for (text, image, or voice) --
 * `ProviderConfig.capability` determines which method(s) the caller invokes;
 * the rest are simply absent.
 */
export interface AiProvider {
  testConnection(): Promise<ConnectionTestResult>;
  generateText?(request: TextGenerationRequest): Promise<TextGenerationResult>;
  generateImage?(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  listVoices?(): Promise<VoiceOption[]>;
  synthesizeVoice?(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult>;
}
