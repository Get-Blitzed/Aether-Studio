import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { AiProviderError } from "./errors.js";
import type { AiProvider, ConnectionTestResult, VoiceOption, VoiceSynthesisRequest, VoiceSynthesisResult } from "./types.js";

export interface PiperVoiceConfig {
  /** Absolute path to the bundled `resources/piper` directory (contains `bin/piper.exe` and `voices/`). */
  piperDir: string;
}

interface PiperVoiceManifestEntry {
  id: string;
  name: string;
  gender?: string;
  locale?: string;
  quality?: string;
}

function runPiper(piperExePath: string, args: string[], stdinText: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(piperExePath, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 16 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    child.stdin?.write(stdinText, "utf-8");
    child.stdin?.end();
  });
}

/**
 * Real, fully offline TTS via a bundled Piper (https://github.com/rhasspy/piper)
 * binary and a small curated set of MIT/CC0/public-domain voice models
 * shipped under resources/piper -- no network call, no API key, and (unlike
 * SapiVoiceProvider) the same voices are available on every machine
 * regardless of what's installed on Windows. Sits between the native SAPI
 * tier and a paid external provider like ElevenLabs on the quality/cost
 * spectrum. Cross-platform in principle (Piper ships Linux/macOS binaries
 * too) but only the Windows binary is currently bundled -- see
 * KNOWN_LIMITATIONS.md.
 */
export class PiperVoiceProvider implements AiProvider {
  private readonly binDir: string;
  private readonly voicesDir: string;
  private readonly exePath: string;

  constructor(config: PiperVoiceConfig) {
    this.binDir = path.join(config.piperDir, "bin");
    this.voicesDir = path.join(config.piperDir, "voices");
    this.exePath = path.join(this.binDir, process.platform === "win32" ? "piper.exe" : "piper");
  }

  private readManifest(): PiperVoiceManifestEntry[] {
    const manifestPath = path.join(this.voicesDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return [];
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as PiperVoiceManifestEntry[];
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!fs.existsSync(this.exePath)) {
      return { ok: false, message: `The bundled Piper engine was not found at ${this.exePath}.` };
    }
    const voices = this.readManifest();
    if (voices.length === 0) {
      return { ok: false, message: "No bundled Piper voice models were found." };
    }
    return { ok: true, message: `${voices.length} bundled offline voice(s) available: ${voices.map((v) => v.name).join(", ")}.` };
  }

  async listVoices(): Promise<VoiceOption[]> {
    return this.readManifest().map((entry) => ({ id: entry.id, name: entry.name, gender: entry.gender, locale: entry.locale }));
  }

  async synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    if (!request.text.trim()) {
      throw new AiProviderError("Voice synthesis requires non-empty text.", "INVALID_CONFIG");
    }
    if (!fs.existsSync(this.exePath)) {
      throw new AiProviderError(`The bundled Piper engine was not found at ${this.exePath}.`, "NOT_SUPPORTED");
    }

    const voices = this.readManifest();
    const voice = voices.find((v) => v.id === request.voiceId) ?? voices[0];
    if (!voice) {
      throw new AiProviderError("No bundled Piper voice models are available.", "INVALID_CONFIG");
    }
    const modelPath = path.join(this.voicesDir, voice.id, "model.onnx");
    if (!fs.existsSync(modelPath)) {
      throw new AiProviderError(`Voice model not found: ${modelPath}`, "INVALID_CONFIG");
    }

    const outputPath = path.join(os.tmpdir(), `aether-piper-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    // Piper's --length_scale is the inverse of a speaking-rate dial (>1 slower,
    // <1 faster); map the app-wide -10..10 SAPI-style `rate` onto it here so
    // callers don't need a Piper-specific convention.
    const rate = Math.max(-10, Math.min(10, request.rate ?? 0));
    const lengthScale = (1 - rate / 20).toFixed(3);
    // This frozen Piper CLI build has no SSML/prosody support, so
    // request.pitchSemitones (meaningful for SapiVoiceProvider) is silently
    // ignored here -- there's no equivalent knob to apply it to.

    try {
      await runPiper(
        this.exePath,
        ["--model", modelPath, "--output_file", outputPath, "--length_scale", lengthScale],
        request.text,
        60_000,
      );
      if (!fs.existsSync(outputPath)) {
        throw new AiProviderError("Voice synthesis did not produce an output file.", "VOICE_SYNTHESIS_FAILED");
      }
      return { filePath: outputPath, usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 } };
    } catch (cause) {
      if (cause instanceof AiProviderError) throw cause;
      throw new AiProviderError("Failed to synthesize speech with the bundled Piper voice.", "VOICE_SYNTHESIS_FAILED", cause);
    }
  }
}
