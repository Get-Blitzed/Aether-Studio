import { AiProviderError } from "./errors.js";
import { usageFromTokenCounts } from "./costEstimate.js";
import type { AiProvider, ConnectionTestResult, TextGenerationRequest, TextGenerationResult } from "./types.js";

export interface GenericRestConfig {
  baseUrl: string;
  apiKey?: string;
  /** JSON request body template; `{{prompt}}` is substituted with the (JSON-escaped) prompt text. Defaults to `{"prompt": "{{prompt}}"}`. */
  requestTemplate?: string;
}

function substitutePrompt(template: string, prompt: string): string {
  const escaped = JSON.stringify(prompt).slice(1, -1);
  return template.replace(/\{\{\s*prompt\s*\}\}/g, escaped);
}

/**
 * A configurable adapter for an arbitrary text-generation REST endpoint
 * that doesn't speak OpenAI's wire format. The request body is a
 * user-supplied JSON template with `{{prompt}}` substituted in; the
 * response is parsed against a few common shapes (a top-level `text`
 * field, an OpenAI-style `choices[0].message.content`, or a top-level
 * `output` string) since a truly generic adapter can't know its target
 * API's exact response shape in advance.
 */
export class GenericRestProvider implements AiProvider {
  constructor(private readonly config: GenericRestConfig) {
    if (!config.baseUrl) throw new AiProviderError("A generic REST provider requires a base URL.", "INVALID_CONFIG");
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(this.config.baseUrl, { method: "GET" });
      return { ok: response.ok, message: response.ok ? "Endpoint responded." : `Endpoint responded with HTTP ${response.status}.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const template = this.config.requestTemplate ?? '{"prompt": "{{prompt}}"}';
    const body = substitutePrompt(template, request.prompt);

    let response: Response;
    try {
      response = await fetch(this.config.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body,
      });
    } catch (error) {
      throw new AiProviderError("Request to the generic REST provider failed.", "NETWORK_ERROR", error);
    }
    if (!response.ok) {
      throw new AiProviderError(`Generic REST provider responded with HTTP ${response.status}.`, "REQUEST_FAILED");
    }

    const json = (await response.json()) as {
      text?: string;
      output?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.text ?? json.output ?? json.choices?.[0]?.message?.content ?? JSON.stringify(json);
    return { text, usage: usageFromTokenCounts(Math.ceil(request.prompt.length / 4), Math.ceil(text.length / 4)) };
  }
}
