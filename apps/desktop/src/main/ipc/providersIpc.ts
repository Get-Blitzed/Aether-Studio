import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { ProviderConfigRepository, BackgroundJobRepository, type AetherDatabase, type SettingsRepository } from "@aether/database";
import { generateId, nowIso, sanitizeFileName, type Logger } from "@aether/core";
import { readManifest, saveProject } from "@aether/project-engine";
import { probeMedia, generateWaveformImage, analyzeLoudness } from "@aether/media-engine";
import {
  createProvider,
  buildStructuredPrompt,
  assertNotBlockedByOfflineMode,
  AiProviderError,
} from "@aether/ai-providers";
import type { ProviderConfig, BackgroundJob, VoiceTake } from "@aether/shared-types";
import type { AppError } from "./projectsIpc.js";
import type { SecretsStore } from "../secretsStore.js";
import { buildAssetFromFile } from "../assetBuilder.js";

function toAppError(error: unknown): AppError {
  if (error instanceof AiProviderError) return { title: "Provider error", detail: error.message, code: error.code };
  if (error instanceof Error) return { title: "Provider error", detail: error.message };
  return { title: "Provider error", detail: String(error) };
}

interface RegisterDeps {
  db: AetherDatabase;
  settingsRepo: SettingsRepository;
  secretsStore: SecretsStore;
  logger: Logger;
}

export interface RunJobArgs {
  jobType: string;
  providerId: string;
  input: Record<string, string | number | undefined>;
  projectDir?: string;
  imageWidth?: number;
  imageHeight?: number;
  voiceId?: string;
  voiceRate?: number;
  voicePitchSemitones?: number;
  voiceVolume?: number;
  voiceProfileId?: string;
  scriptSegmentId?: string;
}

export function registerProvidersIpc({ db, settingsRepo, secretsStore, logger }: RegisterDeps): void {
  const providerRepo = new ProviderConfigRepository(db);
  const jobRepo = new BackgroundJobRepository(db);

  ipcMain.handle("providers:list", () => providerRepo.list());

  ipcMain.handle("providers:list-jobs", () => jobRepo.listRecent());

  ipcMain.handle(
    "providers:save",
    (_event, args: { config: Omit<ProviderConfig, "hasSecret">; secret?: string }) => {
      try {
        let encryptedSecret: string | undefined;
        if (args.secret === undefined) {
          encryptedSecret = undefined;
        } else if (args.secret === "") {
          encryptedSecret = "";
        } else {
          encryptedSecret = secretsStore.encrypt(args.secret);
        }
        const saved = providerRepo.save(args.config, encryptedSecret);
        return { ok: true as const, config: saved };
      } catch (error) {
        logger.error("providers:save failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle("providers:remove", (_event, id: string) => {
    try {
      providerRepo.remove(id);
      return { ok: true as const };
    } catch (error) {
      logger.error("providers:remove failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("providers:test", async (_event, id: string) => {
    try {
      const config = providerRepo.get(id);
      if (!config) return { ok: false as const, error: { title: "Provider not found", detail: id } };
      assertNotBlockedByOfflineMode(config.kind, settingsRepo.get().offlineMode);
      const encrypted = providerRepo.getEncryptedSecret(id);
      const secret = encrypted && secretsStore.isAvailable() ? secretsStore.decrypt(encrypted) : undefined;
      const provider = createProvider(config, secret);
      const result = await provider.testConnection();
      return { ok: true as const, result };
    } catch (error) {
      logger.error("providers:test failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("providers:list-voices", async (_event, providerId: string) => {
    try {
      const config = providerRepo.get(providerId);
      if (!config) return { ok: false as const, error: { title: "Provider not found", detail: providerId } };
      assertNotBlockedByOfflineMode(config.kind, settingsRepo.get().offlineMode);
      const encrypted = providerRepo.getEncryptedSecret(providerId);
      const secret = encrypted && secretsStore.isAvailable() ? secretsStore.decrypt(encrypted) : undefined;
      const provider = createProvider(config, secret);
      if (!provider.listVoices) return { ok: false as const, error: { title: "Not supported", detail: "This provider does not support listing voices." } };
      const voices = await provider.listVoices();
      return { ok: true as const, voices };
    } catch (error) {
      logger.error("providers:list-voices failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("providers:run-job", async (_event, args: RunJobArgs) => {
    const jobId = generateId("job");
    const startedAt = nowIso();
    let job: BackgroundJob = {
      id: jobId,
      jobType: args.jobType,
      providerId: args.providerId,
      status: "running",
      progress: 0.1,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    try {
      const config = providerRepo.get(args.providerId);
      if (!config) throw new AiProviderError("Provider not found.", "INVALID_CONFIG");
      job = { ...job, providerName: config.name };
      jobRepo.save(job);

      assertNotBlockedByOfflineMode(config.kind, settingsRepo.get().offlineMode);

      const encrypted = providerRepo.getEncryptedSecret(args.providerId);
      const secret = encrypted && secretsStore.isAvailable() ? secretsStore.decrypt(encrypted) : undefined;
      const provider = createProvider(config, secret);
      const prompt = buildStructuredPrompt(args.jobType, args.input);

      if (config.capability === "text") {
        if (!provider.generateText) throw new AiProviderError("This provider does not support text generation.", "NOT_SUPPORTED");
        const result = await provider.generateText({ prompt });
        job = { ...job, status: "completed", progress: 1, usage: result.usage, updatedAt: nowIso() };
        jobRepo.save(job);
        return { ok: true as const, job, text: result.text };
      }

      if (config.capability === "image") {
        if (!provider.generateImage) throw new AiProviderError("This provider does not support image generation.", "NOT_SUPPORTED");
        const result = await provider.generateImage({ prompt, width: args.imageWidth, height: args.imageHeight });

        if (!args.projectDir) {
          job = { ...job, status: "completed", progress: 1, usage: result.usage, outputLocation: result.filePath, updatedAt: nowIso() };
          jobRepo.save(job);
          return { ok: true as const, job, imagePath: result.filePath };
        }

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const asset = await buildAssetFromFile(args.projectDir, result.filePath, "graphics", "managed", ffmpegOverridePath, logger);
        fs.unlinkSync(result.filePath);
        const notedAsset = { ...asset, sourceAttribution: `Generated by ${config.name} (${config.kind}) from prompt: ${args.input.prompt ?? ""}` };

        const manifest = readManifest(args.projectDir);
        const updatedManifest = { ...manifest, assets: [...manifest.assets, notedAsset] };
        const savedManifest = saveProject(args.projectDir, updatedManifest);

        job = { ...job, status: "completed", progress: 1, usage: result.usage, outputLocation: notedAsset.filePath, updatedAt: nowIso() };
        jobRepo.save(job);
        return { ok: true as const, job, asset: notedAsset, manifest: savedManifest };
      }

      if (config.capability === "voice") {
        if (!provider.synthesizeVoice) throw new AiProviderError("This provider does not support voice synthesis.", "NOT_SUPPORTED");
        const text = String(args.input.text ?? "");
        const result = await provider.synthesizeVoice({
          text,
          voiceId: args.voiceId,
          rate: args.voiceRate,
          pitchSemitones: args.voicePitchSemitones,
          volume: args.voiceVolume,
        });

        if (!args.projectDir) {
          job = { ...job, status: "completed", progress: 1, usage: result.usage, outputLocation: result.filePath, updatedAt: nowIso() };
          jobRepo.save(job);
          return { ok: true as const, job, audioPath: result.filePath };
        }

        const manifest = readManifest(args.projectDir);
        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const destDir = path.join(args.projectDir, "audio", "takes");
        fs.mkdirSync(destDir, { recursive: true });
        const originalFileName = path.basename(result.filePath);
        const safeName = sanitizeFileName(path.parse(originalFileName).name, "take") + path.extname(originalFileName);
        let destName = safeName;
        let counter = 1;
        while (fs.existsSync(path.join(destDir, destName))) {
          destName = `${path.parse(safeName).name}-${counter}${path.extname(safeName)}`;
          counter += 1;
        }
        const destPath = path.join(destDir, destName);
        fs.copyFileSync(result.filePath, destPath);
        fs.unlinkSync(result.filePath);
        const relativePath = path.join("audio", "takes", destName);

        const existingForProfile = manifest.voiceTakes.filter((t) => t.voiceProfileId === args.voiceProfileId);
        const timestamp = nowIso();
        let take: VoiceTake = {
          id: generateId("take"),
          voiceProfileId: args.voiceProfileId,
          scriptSegmentId: args.scriptSegmentId,
          takeNumber: existingForProfile.length + 1,
          filePath: relativePath,
          originalFileName: destName,
          status: "draft",
          notes: `Synthesized by ${config.name} (${config.kind}).`,
          createdAt: timestamp,
          modifiedAt: timestamp,
        };
        try {
          const probe = await probeMedia(destPath, ffmpegOverridePath);
          take.durationSeconds = probe.durationSeconds;
        } catch (probeError) {
          logger.warn("Synthesized voice take probe failed", { file: destPath, error: String(probeError) });
        }
        try {
          const loudness = await analyzeLoudness(destPath, ffmpegOverridePath);
          take = { ...take, ...loudness };
        } catch (loudnessError) {
          logger.warn("Synthesized voice take loudness analysis failed", { file: destPath, error: String(loudnessError) });
        }
        try {
          const waveformOutput = path.join(args.projectDir, "cache", "previews", `${path.parse(destName).name}-${Date.now()}.png`);
          await generateWaveformImage(destPath, waveformOutput, { ffmpegOverridePath });
          take.waveformImagePath = path.relative(args.projectDir, waveformOutput);
        } catch (waveformError) {
          logger.warn("Synthesized voice take waveform generation failed", { file: destPath, error: String(waveformError) });
        }

        const updatedManifest = { ...manifest, voiceTakes: [...manifest.voiceTakes, take] };
        const savedManifest = saveProject(args.projectDir, updatedManifest);

        job = { ...job, status: "completed", progress: 1, usage: result.usage, outputLocation: take.filePath, updatedAt: nowIso() };
        jobRepo.save(job);
        return { ok: true as const, job, voiceTake: take, manifest: savedManifest };
      }

      throw new AiProviderError(`Unsupported provider capability: ${config.capability}`, "NOT_SUPPORTED");
    } catch (error) {
      logger.error("providers:run-job failed", error);
      const appError = toAppError(error);
      job = { ...job, status: "failed", error: appError.detail, updatedAt: nowIso() };
      jobRepo.save(job);
      return { ok: false as const, error: appError, job };
    }
  });
}
