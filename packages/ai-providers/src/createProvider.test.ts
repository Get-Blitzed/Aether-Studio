import { describe, expect, it } from "vitest";
import { createProvider } from "./createProvider.js";
import { MockProvider } from "./mockProvider.js";
import { OpenAiCompatibleProvider } from "./openAiCompatibleProvider.js";
import { GenericRestProvider } from "./genericRestProvider.js";
import { AiProviderError } from "./errors.js";
import type { ProviderConfig } from "@aether/shared-types";

function baseConfig(overrides: Partial<ProviderConfig>): ProviderConfig {
  return {
    id: "provider_1",
    name: "Test Provider",
    kind: "mock",
    capability: "text",
    enabled: true,
    isDefaultForCapability: false,
    hasSecret: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    modifiedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("createProvider", () => {
  it("builds a MockProvider for kind 'mock'", () => {
    const provider = createProvider(baseConfig({ kind: "mock" }), undefined);
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("builds an OpenAiCompatibleProvider given a secret", () => {
    const provider = createProvider(
      baseConfig({ kind: "openai-compatible", baseUrl: "https://api.example.com/v1", model: "gpt-test" }),
      "sk-test",
    );
    expect(provider).toBeInstanceOf(OpenAiCompatibleProvider);
  });

  it("throws MISSING_SECRET for an openai-compatible provider with no secret", () => {
    try {
      createProvider(baseConfig({ kind: "openai-compatible", baseUrl: "https://api.example.com/v1", model: "gpt-test" }), undefined);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe("MISSING_SECRET");
    }
  });

  it("builds a GenericRestProvider", () => {
    const provider = createProvider(baseConfig({ kind: "generic-rest", baseUrl: "https://api.example.com/generate" }), "token");
    expect(provider).toBeInstanceOf(GenericRestProvider);
  });

  it("throws INVALID_CONFIG for a generic-rest provider with no base URL", () => {
    try {
      createProvider(baseConfig({ kind: "generic-rest", baseUrl: undefined }), undefined);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe("INVALID_CONFIG");
    }
  });
});
