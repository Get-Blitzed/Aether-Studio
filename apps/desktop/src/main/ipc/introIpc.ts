import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { getCacheDir, type Logger } from "@aether/core";
import { SapiVoiceProvider } from "@aether/ai-providers";

const INTRO_TEXT = "Welcome to Aether Studio Suite. Let's create something fantastic.";
// Bumped to v2 when the pitch was deepened -- a new filename forces
// re-synthesis instead of serving a stale cached file with the old voice.
const INTRO_CACHE_FILENAME = "splash-intro-voice-v2.wav";

interface RegisterDeps {
  logger: Logger;
}

/**
 * Synthesizes the one-time Splash screen voice intro via the native
 * Windows voice (SAPI) -- fully offline, no provider configuration
 * required. Cached to disk after the first successful synthesis so the app
 * doesn't re-run PowerShell/System.Speech on every launch; if synthesis
 * ever fails (no voices installed, non-Windows host), the handler reports
 * failure and the Splash screen simply plays silently rather than blocking
 * startup.
 */
export function registerIntroIpc({ logger }: RegisterDeps): void {
  ipcMain.handle("app:get-intro-audio", async () => {
    const cachedPath = path.join(getCacheDir(), INTRO_CACHE_FILENAME);
    if (fs.existsSync(cachedPath)) {
      return { ok: true as const, filePath: cachedPath };
    }

    try {
      const provider = new SapiVoiceProvider();
      const voices = await provider.listVoices();
      const maleVoice = voices.find((v) => v.gender?.toLowerCase() === "male");

      // Medium tone, semi-excited, slightly deep: a touch faster than a
      // natural speaking pace with a negative pitch shift for a deeper
      // read, rather than a flat, robotic (or higher-pitched) default.
      const result = await provider.synthesizeVoice({
        text: INTRO_TEXT,
        voiceId: maleVoice?.id,
        rate: 2,
        pitchSemitones: -3,
      });

      fs.mkdirSync(path.dirname(cachedPath), { recursive: true });
      fs.copyFileSync(result.filePath, cachedPath);
      fs.rmSync(result.filePath, { force: true });
      return { ok: true as const, filePath: cachedPath };
    } catch (error) {
      logger.warn("Splash intro voice synthesis failed; splash will play without narration", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false as const };
    }
  });
}
