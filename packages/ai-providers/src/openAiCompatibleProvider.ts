import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AiProviderError } from "./errors.js";
import { usageFromTokenCounts } from "./costEstimate.js";
import type {
  AiProvider,
  ConnectionTestResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  TextGenerationRequest,
  TextGenerationResult,
} from "./types.js";

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * A real HTTP client for OpenAI's wire format (chat/completions and
 * images/generations), reusable against any endpoint that speaks the same
 * shape -- OpenAI itself, Azure OpenAI, or a self-hosted OpenAI-compatible
 * server (vLLM, LM Studio, etc). Uses the platform's built-in `fetch`
 * (Node 20+ / Electron 31+ ship it natively), no HTTP client dependency.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly config: OpenAiCompatibleConfig) {
    if (!config.baseUrl) throw new AiProviderError("An OpenAI-compatible provider requires a base URL.", "INVALID_CONFIG");
    if (!config.apiKey) throw new AiProviderError("An OpenAI-compatible provider requires an API key.", "MISSING_SECRET");
    if (!config.model) throw new AiProviderError("An OpenAI-compatible provider requires a model name.", "INVALID_CONFIG");
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (!response.ok) {
        return { ok: false, message: `Provider responded with HTTP ${response.status}.` };
      }
      return { ok: true, message: "Connected successfully." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: request.prompt }],
          max_tokens: request.maxTokens,
          temperature: request.temperature,
        }),
      });
    } catch (error) {
      throw new AiProviderError("Request to the text provider failed.", "NETWORK_ERROR", error);
    }
    if (!response.ok) {
      throw new AiProviderError(`Text provider responded with HTTP ${response.status}.`, "REQUEST_FAILED");
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const usage = usageFromTokenCounts(json.usage?.prompt_tokens ?? 0, json.usage?.completion_tokens ?? 0);
    return { text, usage };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const width = request.width ?? 1024;
    const height = request.height ?? 1024;
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ model: this.config.model, prompt: request.prompt, size: `${width}x${height}` }),
      });
    } catch (error) {
      throw new AiProviderError("Request to the image provider failed.", "NETWORK_ERROR", error);
    }
    if (!response.ok) {
      throw new AiProviderError(`Image provider responded with HTTP ${response.status}.`, "REQUEST_FAILED");
    }
    const json = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (!first) throw new AiProviderError("Image provider returned no image data.", "IMAGE_GENERATION_FAILED");

    const outputPath = path.join(os.tmpdir(), `aether-ai-image-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    if (first.b64_json) {
      fs.writeFileSync(outputPath, Buffer.from(first.b64_json, "base64"));
    } else if (first.url) {
      const imageResponse = await fetch(first.url);
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      fs.writeFileSync(outputPath, bytes);
    } else {
      throw new AiProviderError("Image provider response had neither b64_json nor url.", "IMAGE_GENERATION_FAILED");
    }

    return { filePath: outputPath, width, height, usage: usageFromTokenCounts(0, 0) };
  }
}
