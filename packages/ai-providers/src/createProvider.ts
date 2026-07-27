import type { ProviderConfig } from "@aether/shared-types";
import { MockProvider } from "./mockProvider.js";
import { OpenAiCompatibleProvider } from "./openAiCompatibleProvider.js";
import { GenericRestProvider } from "./genericRestProvider.js";
import { AiProviderError } from "./errors.js";
import type { AiProvider } from "./types.js";

/** Builds the right provider implementation for a stored config + its decrypted secret (if any). */
export function createProvider(config: ProviderConfig, secret: string | undefined): AiProvider {
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
    default: {
      const exhaustiveCheck: never = config.kind;
      throw new AiProviderError(`Unknown provider kind: ${String(exhaustiveCheck)}`, "INVALID_CONFIG");
    }
  }
}
