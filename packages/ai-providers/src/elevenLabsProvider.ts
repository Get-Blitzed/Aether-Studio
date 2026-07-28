import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AiProviderError } from "./errors.js";
import type { AiProvider, ConnectionTestResult, VoiceOption, VoiceSynthesisRequest, VoiceSynthesisResult } from "./types.js";

export interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * A real HTTP client for the ElevenLabs text-to-speech API. This is the
 * "external tier" reached only after native Windows (SAPI) voices --
 * requires an API key the user supplies via Provider Manager. Written
 * against ElevenLabs' documented wire format but not exercised against a
 * live account in this environment (no credentials available here); the
 * request/response shapes follow their public API reference exactly, the
 * same posture as Phase 6's OpenAiCompatibleProvider before its first
 * real-account test.
 */
export class ElevenLabsProvider implements AiProvider {
  private readonly baseUrl: string;

  constructor(private readonly config: ElevenLabsConfig) {
    if (!config.apiKey) throw new AiProviderError("ElevenLabs requires an API key.", "MISSING_SECRET");
    this.baseUrl = (config.baseUrl ?? "https://api.elevenlabs.io/v1").replace(/\/$/, "");
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { "xi-api-key": this.config.apiKey },
      });
      if (!response.ok) {
        return { ok: false, message: `ElevenLabs responded with HTTP ${response.status}.` };
      }
      return { ok: true, message: "Connected to ElevenLabs successfully." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async listVoices(): Promise<VoiceOption[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/voices`, { headers: { "xi-api-key": this.config.apiKey } });
    } catch (cause) {
      throw new AiProviderError("Request to ElevenLabs failed.", "NETWORK_ERROR", cause);
    }
    if (!response.ok) {
      throw new AiProviderError(`ElevenLabs responded with HTTP ${response.status}.`, "VOICE_LIST_FAILED");
    }
    const json = (await response.json()) as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
    return (json.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender,
      locale: v.labels?.accent,
    }));
  }

  async synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    if (!request.voiceId) {
      throw new AiProviderError("ElevenLabs synthesis requires a voiceId.", "INVALID_CONFIG");
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/text-to-speech/${request.voiceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": this.config.apiKey },
        body: JSON.stringify({
          text: request.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
    } catch (cause) {
      throw new AiProviderError("Request to ElevenLabs failed.", "NETWORK_ERROR", cause);
    }
    if (!response.ok) {
      throw new AiProviderError(`ElevenLabs responded with HTTP ${response.status}.`, "VOICE_SYNTHESIS_FAILED");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const outputPath = path.join(os.tmpdir(), `aether-elevenlabs-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    fs.writeFileSync(outputPath, bytes);
    return { filePath: outputPath, usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 } };
  }
}
