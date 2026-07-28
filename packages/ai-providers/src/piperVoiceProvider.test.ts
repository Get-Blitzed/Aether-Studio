import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { probeMedia } from "@aether/media-engine";
import { PiperVoiceProvider } from "./piperVoiceProvider.js";
import { AiProviderError } from "./errors.js";

const isWindows = os.platform() === "win32";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const piperDir = path.join(repoRoot, "resources", "piper");
const piperBundled = fs.existsSync(path.join(piperDir, "bin", "piper.exe"));

describe.skipIf(!isWindows || !piperBundled)("PiperVoiceProvider (against the real bundled Piper engine)", () => {
  const provider = new PiperVoiceProvider({ piperDir });

  it("lists the bundled offline voices", async () => {
    const voices = await provider.listVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]!.name).toBeTypeOf("string");
  });

  it("reports a successful connection test", async () => {
    const result = await provider.testConnection();
    expect(result.ok).toBe(true);
  });

  it("synthesizes real speech audio to a playable WAV file", async () => {
    const result = await provider.synthesizeVoice({ text: "Hello from Aether Studio Suite." });
    expect(fs.existsSync(result.filePath)).toBe(true);
    const probe = await probeMedia(result.filePath);
    expect(probe.durationSeconds).toBeGreaterThan(0);
    expect(probe.audioCodec).toBeTruthy();
    fs.rmSync(result.filePath, { force: true });
  }, 30_000);

  it("synthesizes with a specific requested voice", async () => {
    const voices = await provider.listVoices();
    const target = voices.find((v) => v.id === "en_US-kathleen-low") ?? voices[voices.length - 1]!;
    const result = await provider.synthesizeVoice({ text: "This is a different voice.", voiceId: target.id });
    expect(fs.existsSync(result.filePath)).toBe(true);
    fs.rmSync(result.filePath, { force: true });
  }, 30_000);

  it("rejects synthesis of empty text", async () => {
    await expect(provider.synthesizeVoice({ text: "   " })).rejects.toBeInstanceOf(AiProviderError);
  });
});
