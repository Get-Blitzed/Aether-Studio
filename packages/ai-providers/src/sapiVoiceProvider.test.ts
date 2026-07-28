import fs from "node:fs";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { probeMedia } from "@aether/media-engine";
import { SapiVoiceProvider } from "./sapiVoiceProvider.js";
import { AiProviderError } from "./errors.js";

const isWindows = os.platform() === "win32";

describe.skipIf(!isWindows)("SapiVoiceProvider (against the real Windows System.Speech engine)", () => {
  const provider = new SapiVoiceProvider();

  it("lists at least one installed native voice", async () => {
    const voices = await provider.listVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]!.name).toBeTypeOf("string");
  }, 20_000);

  it("reports a successful connection test when voices are installed", async () => {
    const result = await provider.testConnection();
    expect(result.ok).toBe(true);
  }, 20_000);

  it("synthesizes real speech audio to a playable WAV file", async () => {
    const result = await provider.synthesizeVoice({ text: "Hello from Aether Studio Suite." });
    expect(fs.existsSync(result.filePath)).toBe(true);
    const probe = await probeMedia(result.filePath);
    expect(probe.durationSeconds).toBeGreaterThan(0);
    expect(probe.audioCodec).toBeTruthy();
    fs.rmSync(result.filePath, { force: true });
  }, 30_000);

  it("rejects synthesis of empty text", async () => {
    await expect(provider.synthesizeVoice({ text: "   " })).rejects.toBeInstanceOf(AiProviderError);
  });
});
