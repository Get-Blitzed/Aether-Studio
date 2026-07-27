import fs from "node:fs";
import path from "node:path";
import { ipcMain, dialog, type BrowserWindow } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import { nowIso, sanitizeFileName, type Logger } from "@aether/core";
import {
  probeMedia,
  generateWaveformImage,
  analyzeLoudness,
  trimAudio,
  normalizeLoudness,
  denoiseAudio,
  removeSilence,
  mergeAudioTakes,
  convertAudioFormat,
  type AudioExportFormat,
} from "@aether/media-engine";
import type { VoiceTake } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Voice Studio error", detail: error.message };
  return { title: "Voice Studio error", detail: String(error) };
}

function takesDirFor(projectDir: string): string {
  return path.join(projectDir, "audio", "takes");
}

function waveformsDirFor(projectDir: string): string {
  return path.join(projectDir, "cache", "previews");
}

function absoluteTakePath(projectDir: string, take: VoiceTake): string {
  return path.join(projectDir, take.filePath);
}

async function refreshDerivedMetadata(
  projectDir: string,
  take: VoiceTake,
  ffmpegOverridePath: string | undefined,
  logger: Logger,
): Promise<VoiceTake> {
  const absolute = absoluteTakePath(projectDir, take);
  let durationSeconds = take.durationSeconds;
  try {
    const probe = await probeMedia(absolute, ffmpegOverridePath);
    durationSeconds = probe.durationSeconds;
  } catch (error) {
    logger.warn("Voice take probe failed after processing", { file: absolute, error: String(error) });
  }

  let loudness: { integratedLufs?: number; loudnessRangeLu?: number; truePeakDbfs?: number } = {};
  try {
    loudness = await analyzeLoudness(absolute, ffmpegOverridePath);
  } catch (error) {
    logger.warn("Loudness analysis failed after processing", { file: absolute, error: String(error) });
  }

  const waveformName = `${path.parse(take.filePath).name}-${Date.now()}.png`;
  const waveformOutput = path.join(waveformsDirFor(projectDir), waveformName);
  let waveformImagePath = take.waveformImagePath;
  try {
    await generateWaveformImage(absolute, waveformOutput, { ffmpegOverridePath });
    waveformImagePath = path.relative(projectDir, waveformOutput);
  } catch (error) {
    logger.warn("Waveform regeneration failed after processing", { file: absolute, error: String(error) });
  }

  return {
    ...take,
    durationSeconds,
    integratedLufs: loudness.integratedLufs,
    loudnessRangeLu: loudness.loudnessRangeLu,
    truePeakDbfs: loudness.truePeakDbfs,
    waveformImagePath,
    modifiedAt: nowIso(),
  };
}

interface RegisterDeps {
  logger: Logger;
  settingsRepo: SettingsRepository;
  getWindow: () => BrowserWindow | null;
}

export function registerVoiceIpc({ logger, settingsRepo, getWindow }: RegisterDeps): void {
  ipcMain.handle("voice:choose-audio-files", async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      title: "Choose narration audio to import",
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "flac", "ogg"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
  });

  ipcMain.handle(
    "voice:import-takes",
    async (
      _event,
      args: { projectDir: string; filePaths: string[]; voiceProfileId?: string; scriptSegmentId?: string },
    ) => {
      try {
        const manifest = readManifest(args.projectDir);
        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const destDir = takesDirFor(args.projectDir);
        fs.mkdirSync(destDir, { recursive: true });

        const existingForProfile = manifest.voiceTakes.filter((t) => t.voiceProfileId === args.voiceProfileId);
        let nextTakeNumber = existingForProfile.length + 1;
        const added: VoiceTake[] = [];

        for (const filePath of args.filePaths) {
          const originalFileName = path.basename(filePath);
          const safeName = sanitizeFileName(path.parse(originalFileName).name, "take") + path.extname(originalFileName);
          let destName = safeName;
          let counter = 1;
          while (fs.existsSync(path.join(destDir, destName))) {
            destName = `${path.parse(safeName).name}-${counter}${path.extname(safeName)}`;
            counter += 1;
          }
          fs.copyFileSync(filePath, path.join(destDir, destName));
          const relativePath = path.join("audio", "takes", destName);

          const timestamp = nowIso();
          let take: VoiceTake = {
            id: `take_${Date.now()}_${nextTakeNumber}`,
            voiceProfileId: args.voiceProfileId,
            scriptSegmentId: args.scriptSegmentId,
            takeNumber: nextTakeNumber,
            filePath: relativePath,
            originalFileName,
            status: "draft",
            createdAt: timestamp,
            modifiedAt: timestamp,
          };
          take = await refreshDerivedMetadata(args.projectDir, take, ffmpegOverridePath, logger);
          added.push(take);
          nextTakeNumber += 1;
        }

        const updatedManifest = { ...manifest, voiceTakes: [...manifest.voiceTakes, ...added] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, added: added.length };
      } catch (error) {
        logger.error("voice:import-takes failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle(
    "voice:process-take",
    async (
      _event,
      args: {
        projectDir: string;
        takeId: string;
        action: "trim" | "normalize" | "denoise" | "remove-silence";
        trimStartSeconds?: number;
        trimEndSeconds?: number;
      },
    ) => {
      try {
        const manifest = readManifest(args.projectDir);
        const take = manifest.voiceTakes.find((t) => t.id === args.takeId);
        if (!take) return { ok: false as const, error: { title: "Take not found", detail: args.takeId } };

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const absolute = absoluteTakePath(args.projectDir, take);
        const tempOutput = `${absolute}.processing-${Date.now()}${path.extname(absolute)}`;

        switch (args.action) {
          case "trim":
            if (args.trimStartSeconds === undefined || args.trimEndSeconds === undefined) {
              return {
                ok: false as const,
                error: { title: "Missing trim range", detail: "Both a start and end time are required." },
              };
            }
            await trimAudio(absolute, tempOutput, args.trimStartSeconds, args.trimEndSeconds, ffmpegOverridePath);
            break;
          case "normalize":
            await normalizeLoudness(absolute, tempOutput, -16, ffmpegOverridePath);
            break;
          case "denoise":
            await denoiseAudio(absolute, tempOutput, ffmpegOverridePath);
            break;
          case "remove-silence":
            await removeSilence(absolute, tempOutput, { ffmpegOverridePath });
            break;
        }

        // Only replace the original once the processed file exists -- a
        // mid-process ffmpeg failure leaves the take untouched.
        fs.renameSync(tempOutput, absolute);
        const updatedTake = await refreshDerivedMetadata(args.projectDir, take, ffmpegOverridePath, logger);
        const updatedManifest = {
          ...manifest,
          voiceTakes: manifest.voiceTakes.map((t) => (t.id === args.takeId ? updatedTake : t)),
        };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved };
      } catch (error) {
        logger.error("voice:process-take failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle(
    "voice:merge-takes",
    async (_event, args: { projectDir: string; takeIds: string[]; voiceProfileId?: string }) => {
      try {
        if (args.takeIds.length < 2) {
          return {
            ok: false as const,
            error: { title: "Select at least two takes", detail: "Merging requires two or more takes." },
          };
        }
        const manifest = readManifest(args.projectDir);
        const takes = args.takeIds
          .map((id) => manifest.voiceTakes.find((t) => t.id === id))
          .filter((t): t is VoiceTake => Boolean(t));
        if (takes.length !== args.takeIds.length) {
          return { ok: false as const, error: { title: "Take not found", detail: "One or more takes no longer exist." } };
        }

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const destDir = takesDirFor(args.projectDir);
        fs.mkdirSync(destDir, { recursive: true });
        const mergedName = `merged-${Date.now()}.wav`;
        const mergedAbsolute = path.join(destDir, mergedName);
        await mergeAudioTakes(
          takes.map((t) => absoluteTakePath(args.projectDir, t)),
          mergedAbsolute,
          ffmpegOverridePath,
        );

        const existingForProfile = manifest.voiceTakes.filter((t) => t.voiceProfileId === args.voiceProfileId);
        const timestamp = nowIso();
        let mergedTake: VoiceTake = {
          id: `take_${Date.now()}_merged`,
          voiceProfileId: args.voiceProfileId,
          takeNumber: existingForProfile.length + 1,
          filePath: path.join("audio", "takes", mergedName),
          originalFileName: mergedName,
          status: "draft",
          notes: `Merged from: ${takes.map((t) => t.originalFileName).join(", ")}`,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        mergedTake = await refreshDerivedMetadata(args.projectDir, mergedTake, ffmpegOverridePath, logger);

        const updatedManifest = { ...manifest, voiceTakes: [...manifest.voiceTakes, mergedTake] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved };
      } catch (error) {
        logger.error("voice:merge-takes failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle(
    "voice:export-take",
    async (_event, args: { projectDir: string; takeId: string; format: AudioExportFormat }) => {
      const win = getWindow();
      if (!win) return { ok: false as const, error: { title: "No window", detail: "Application window unavailable." } };
      try {
        const manifest = readManifest(args.projectDir);
        const take = manifest.voiceTakes.find((t) => t.id === args.takeId);
        if (!take) return { ok: false as const, error: { title: "Take not found", detail: args.takeId } };

        const result = await dialog.showSaveDialog(win, {
          title: `Export take as ${args.format.toUpperCase()}`,
          defaultPath: `${path.parse(take.originalFileName).name}.${args.format}`,
          filters: [{ name: args.format.toUpperCase(), extensions: [args.format] }],
        });
        if (result.canceled || !result.filePath) return { ok: false as const, canceled: true as const };

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        await convertAudioFormat(
          absoluteTakePath(args.projectDir, take),
          result.filePath,
          args.format,
          ffmpegOverridePath,
        );
        return { ok: true as const, exportedPath: result.filePath };
      } catch (error) {
        logger.error("voice:export-take failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle("voice:remove-take", (_event, projectDir: string, takeId: string) => {
    try {
      const manifest = readManifest(projectDir);
      const take = manifest.voiceTakes.find((t) => t.id === takeId);
      if (!take) return { ok: false as const, error: { title: "Take not found", detail: takeId } };

      const absolute = absoluteTakePath(projectDir, take);
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
      if (take.waveformImagePath) {
        const waveformAbs = path.join(projectDir, take.waveformImagePath);
        if (fs.existsSync(waveformAbs)) fs.unlinkSync(waveformAbs);
      }

      const updatedManifest = { ...manifest, voiceTakes: manifest.voiceTakes.filter((t) => t.id !== takeId) };
      const saved = saveProject(projectDir, updatedManifest);
      return { ok: true as const, manifest: saved };
    } catch (error) {
      logger.error("voice:remove-take failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });
}
