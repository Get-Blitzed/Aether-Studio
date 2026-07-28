import type { ProviderConfig } from "@aether/shared-types";
import { MockProvider } from "./mockProvider.js";
import { OpenAiCompatibleProvider } from "./openAiCompatibleProvider.js";
import { GenericRestProvider } from "./genericRestProvider.js";
import { SapiVoiceProvider } from "./sapiVoiceProvider.js";
import { PiperVoiceProvider } from "./piperVoiceProvider.js";
import { ElevenLabsProvider } from "./elevenLabsProvider.js";
import { AiProviderError } from "./errors.js";
import type { AiProvider } from "./types.js";

export interface CreateProviderContext {
  /** Absolute path to the bundled `resources/piper` directory, required for kind "piper-voice". */
  piperDir?: string;
}

/** Builds the right provider implementation for a stored config + its decrypted secret (if any). */
export function createProvider(config: ProviderConfig, secret: string | undefined, context: CreateProviderContext = {}): AiProvider {
  switch (config.kind) {
    case "mock":
      return new MockProvider();
    case "openai-compatible":
      return new OpenAiCompatibleProvider({
        baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
        apiKey: secret ?? "",
        model: config.model ?? "",
      });
    case "generic-rest":
      return new GenericRestProvider({
        baseUrl: config.baseUrl ?? "",
        apiKey: secret,
        requestTemplate: config.requestTemplate,
      });
    case "sapi-voice":
      return new SapiVoiceProvider();
    case "piper-voice":
      if (!context.piperDir) throw new AiProviderError("The bundled Piper voice directory was not provided.", "INVALID_CONFIG");
      return new PiperVoiceProvider({ piperDir: context.piperDir });
    case "elevenlabs":
      return new ElevenLabsProvider({
        baseUrl: config.baseUrl ?? "https://api.elevenlabs.io/v1",
        apiKey: secret ?? "",
      });
    default: {
      const exhaustiveCheck: never = config.kind;
      throw new AiProviderError(`Unknown provider kind: ${String(exhaustiveCheck)}`, "INVALID_CONFIG");
    }
  }
}
