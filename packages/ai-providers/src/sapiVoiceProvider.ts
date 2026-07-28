import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { AiProviderError } from "./errors.js";
import type { AiProvider, ConnectionTestResult, VoiceOption, VoiceSynthesisRequest, VoiceSynthesisResult } from "./types.js";

/**
 * Lists installed voices as JSON, always as an array (`@(...)` forces
 * PowerShell's pipeline-to-array coercion even for zero or one result,
 * which `ConvertTo-Json` would otherwise unwrap into a bare object).
 */
const LIST_VOICES_SCRIPT = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
  $info = $_.VoiceInfo
  [PSCustomObject]@{ name = $info.Name; gender = $info.Gender.ToString(); culture = $info.Culture.Name }
}
$synth.Dispose()
ConvertTo-Json -InputObject @($voices) -Compress
`;

/**
 * Synthesizes speech to a WAV file. All dynamic values (text, voice name,
 * output path, rate/pitch/volume) are passed via a JSON config file read
 * at runtime rather than interpolated into the script -- the same
 * "textfile=" pattern used for ffmpeg drawtext elsewhere in this codebase,
 * so no user-supplied text or path can ever be reinterpreted as script
 * syntax. Pitch isn't exposed by classic System.Speech properties, so it's
 * applied via an SSML <prosody> wrapper (XML-escaped) around the text.
 */
const SYNTHESIZE_SCRIPT = `
param([string]$ConfigPath)
Add-Type -AssemblyName System.Speech
$config = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($config.voiceName) {
  try { $synth.SelectVoice($config.voiceName) } catch { }
}
$synth.Rate = [int]$config.rate
$synth.Volume = [int]$config.volume
$synth.SetOutputToWaveFile($config.outputPath)
$text = Get-Content -Raw -Path $config.textPath
$escapedText = [System.Security.SecurityElement]::Escape($text)
$voiceName = [System.Security.SecurityElement]::Escape($synth.Voice.Name)
$spokenContent = $escapedText
if ($config.pitchSemitones -ne 0) {
  # SAPI's SSML parser rejects a bare <prosody> with no attributes, so the
  # wrapper is only emitted when there's actually a pitch shift to apply.
  $spokenContent = "<prosody pitch='" + [string]$config.pitchSemitones + "st'>" + $escapedText + "</prosody>"
}
$ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='" + $voiceName + "'>" + $spokenContent + "</voice></speak>"
$synth.SpeakSsml($ssml)
$synth.Dispose()
`;

function runPowerShellScript(scriptContents: string, args: string[] = [], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-sapi-"));
    const scriptPath = path.join(tempDir, "script.ps1");
    fs.writeFileSync(scriptPath, scriptContents, "utf-8");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 16 },
      (error, stdout, stderr) => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (error) {
          reject(Object.assign(error, { stdout, stderr }));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

interface RawVoiceEntry {
  name: string;
  gender?: string;
  culture?: string;
}

/**
 * Real, fully offline TTS via the Windows System.Speech API (SAPI) --
 * whatever voices are installed on this machine, with no network call and
 * no API key. This is the "native tier" the app tries before reaching for
 * an external provider like ElevenLabs. Only available on Windows.
 */
export class SapiVoiceProvider implements AiProvider {
  async testConnection(): Promise<ConnectionTestResult> {
    if (process.platform !== "win32") {
      return { ok: false, message: "Windows SAPI voices are only available on Windows." };
    }
    try {
      const voices = await this.listVoices();
      if (voices.length === 0) {
        return { ok: false, message: "No native Windows voices are installed on this system." };
      }
      return { ok: true, message: `${voices.length} native Windows voice(s) available: ${voices.map((v) => v.name).join(", ")}.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async listVoices(): Promise<VoiceOption[]> {
    if (process.platform !== "win32") return [];
    let stdout: string;
    try {
      stdout = await runPowerShellScript(LIST_VOICES_SCRIPT);
    } catch (cause) {
      throw new AiProviderError("Failed to enumerate installed Windows voices.", "VOICE_LIST_FAILED", cause);
    }
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    let entries: RawVoiceEntry[];
    try {
      entries = JSON.parse(trimmed) as RawVoiceEntry[];
    } catch (cause) {
      throw new AiProviderError("Could not parse the installed voice list.", "VOICE_LIST_FAILED", cause);
    }
    return entries.map((entry) => ({ id: entry.name, name: entry.name, gender: entry.gender, locale: entry.culture }));
  }

  async synthesizeVoice(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    if (process.platform !== "win32") {
      throw new AiProviderError("Windows SAPI voices are only available on Windows.", "NOT_SUPPORTED");
    }
    if (!request.text.trim()) {
      throw new AiProviderError("Voice synthesis requires non-empty text.", "INVALID_CONFIG");
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-sapi-synth-"));
    const textPath = path.join(tempDir, "text.txt");
    const configPath = path.join(tempDir, "config.json");
    const outputPath = path.join(os.tmpdir(), `aether-sapi-voice-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);

    fs.writeFileSync(textPath, request.text, "utf-8");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        textPath,
        outputPath,
        voiceName: request.voiceId ?? "",
        rate: Math.max(-10, Math.min(10, request.rate ?? 0)),
        volume: Math.max(0, Math.min(100, request.volume ?? 100)),
        pitchSemitones: request.pitchSemitones ?? 0,
      }),
      "utf-8",
    );

    try {
      await runPowerShellScript(SYNTHESIZE_SCRIPT, [configPath], 60_000);
      if (!fs.existsSync(outputPath)) {
        throw new AiProviderError("Voice synthesis did not produce an output file.", "VOICE_SYNTHESIS_FAILED");
      }
      return { filePath: outputPath, usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 } };
    } catch (cause) {
      if (cause instanceof AiProviderError) throw cause;
      throw new AiProviderError("Failed to synthesize speech with the native Windows voice.", "VOICE_SYNTHESIS_FAILED", cause);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
