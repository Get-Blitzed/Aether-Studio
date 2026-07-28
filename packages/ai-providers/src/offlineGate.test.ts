import { describe, expect, it } from "vitest";
import { assertNotBlockedByOfflineMode } from "./offlineGate.js";
import { AiProviderError } from "./errors.js";

describe("assertNotBlockedByOfflineMode", () => {
  it("never blocks the mock provider", () => {
    expect(() => assertNotBlockedByOfflineMode("mock", true)).not.toThrow();
    expect(() => assertNotBlockedByOfflineMode("mock", false)).not.toThrow();
  });

  it("never blocks the native SAPI voice provider (it never touches the network)", () => {
    expect(() => assertNotBlockedByOfflineMode("sapi-voice", true)).not.toThrow();
    expect(() => assertNotBlockedByOfflineMode("sapi-voice", false)).not.toThrow();
  });

  it("never blocks the bundled Piper voice provider (it never touches the network)", () => {
    expect(() => assertNotBlockedByOfflineMode("piper-voice", true)).not.toThrow();
    expect(() => assertNotBlockedByOfflineMode("piper-voice", false)).not.toThrow();
  });

  it("blocks the elevenlabs provider when offline mode is on", () => {
    expect(() => assertNotBlockedByOfflineMode("elevenlabs", true)).toThrow(AiProviderError);
    expect(() => assertNotBlockedByOfflineMode("elevenlabs", false)).not.toThrow();
  });

  it("blocks networked providers when offline mode is on", () => {
    expect(() => assertNotBlockedByOfflineMode("openai-compatible", true)).toThrow(AiProviderError);
    expect(() => assertNotBlockedByOfflineMode("generic-rest", true)).toThrow(AiProviderError);
  });

  it("allows networked providers when offline mode is off", () => {
    expect(() => assertNotBlockedByOfflineMode("openai-compatible", false)).not.toThrow();
    expect(() => assertNotBlockedByOfflineMode("generic-rest", false)).not.toThrow();
  });

  it("throws with the OFFLINE_MODE_BLOCKED code", () => {
    try {
      assertNotBlockedByOfflineMode("openai-compatible", true);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe("OFFLINE_MODE_BLOCKED");
    }
  });
});
