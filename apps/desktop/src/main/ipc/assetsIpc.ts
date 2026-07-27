import fs from "node:fs";
import path from "node:path";
import { ipcMain, dialog, shell, type BrowserWindow } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import { nowIso, sanitizeFileName, type Logger } from "@aether/core";
import {
  computeFileChecksum,
  probeMedia,
  generateVideoThumbnail,
  generateWaveformImage,
  classifyFileKind,
  checkFfmpegStatus,
  MediaEngineError,
} from "@aether/media-engine";
import type { Asset, AssetCategory } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Asset error", detail: error.message };
  return { title: "Asset error", detail: String(error) };
}

function assetsDirFor(projectDir: string): string {
  return path.join(projectDir, "assets");
}

function previewsDirFor(projectDir: string): string {
  return path.join(projectDir, "cache", "previews");
}

/** Resolves an asset's stored path (relative when managed, absolute when linked) to a real absolute path. */
function resolveAssetPath(projectDir: string, asset: Pick<Asset, "storageMode" | "filePath">): string {
  return asset.storageMode === "managed" ? path.join(projectDir, asset.filePath) : asset.filePath;
}

async function buildAssetFromFile(
  projectDir: string,
  sourcePath: string,
  category: AssetCategory,
  storageMode: "managed" | "linked",
  ffmpegOverridePath: string | undefined,
  logger: Logger,
): Promise<Asset> {
  const timestamp = nowIso();
  const originalFileName = path.basename(sourcePath);
  const checksumSha256 = await computeFileChecksum(sourcePath);

  let storedRelativeOrAbsolutePath: string;
  if (storageMode === "managed") {
    const destDir = path.join(assetsDirFor(projectDir), category);
    fs.mkdirSync(destDir, { recursive: true });
    const safeName = sanitizeFileName(path.parse(originalFileName).name, "asset") + path.extname(originalFileName);
    let destName = safeName;
    let counter = 1;
    while (fs.existsSync(path.join(destDir, destName))) {
      destName = `${path.parse(safeName).name}-${counter}${path.extname(safeName)}`;
      counter += 1;
    }
    fs.copyFileSync(sourcePath, path.join(destDir, destName));
    storedRelativeOrAbsolutePath = path.join("assets", category, destName);
  } else {
    storedRelativeOrAbsolutePath = sourcePath;
  }

  const absolutePath =
    storageMode === "managed" ? path.join(projectDir, storedRelativeOrAbsolutePath) : storedRelativeOrAbsolutePath;

  const kind = classifyFileKind(originalFileName);
  let durationSeconds: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let thumbnailPath: string | undefined;
  let waveformImagePath: string | undefined;

  if (kind === "video" || kind === "audio") {
    try {
      const probe = await probeMedia(absolutePath, ffmpegOverridePath);
      durationSeconds = probe.durationSeconds;
      width = probe.width;
      height = probe.height;
    } catch (error) {
      logger.warn("Media probe failed; continuing without duration/resolution metadata", {
        file: absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (kind === "video") {
    const previewsDir = previewsDirFor(projectDir);
    const outputPath = path.join(previewsDir, `${path.parse(destNameSafe(storedRelativeOrAbsolutePath)).name}.jpg`);
    try {
      await generateVideoThumbnail(absolutePath, outputPath, { ffmpegOverridePath });
      thumbnailPath = path.relative(projectDir, outputPath);
    } catch (error) {
      logger.warn("Video thumbnail generation failed; asset will show a generic icon instead", {
        file: absolutePath,
        error: error instanceof MediaEngineError ? error.code : String(error),
      });
    }
  } else if (kind === "audio") {
    const previewsDir = previewsDirFor(projectDir);
    const outputPath = path.join(previewsDir, `${path.parse(destNameSafe(storedRelativeOrAbsolutePath)).name}.png`);
    try {
      await generateWaveformImage(absolutePath, outputPath, { ffmpegOverridePath });
      waveformImagePath = path.relative(projectDir, outputPath);
    } catch (error) {
      logger.warn("Waveform generation failed; asset will show without a waveform preview", {
        file: absolutePath,
        error: error instanceof MediaEngineError ? error.code : String(error),
      });
    }
  }

  let fileSizeBytes: number | undefined;
  try {
    fileSizeBytes = fs.statSync(absolutePath).size;
  } catch {
    fileSizeBytes = undefined;
  }

  return {
    id: `asset_${checksumSha256.slice(0, 12)}_${Date.now()}`,
    category,
    storageMode,
    filePath: storedRelativeOrAbsolutePath,
    originalFileName,
    fileSizeBytes,
    checksumSha256,
    durationSeconds,
    width,
    height,
    thumbnailPath,
    waveformImagePath,
    tags: [],
    collections: [],
    isFavorite: false,
    usageCount: 0,
    importedAt: timestamp,
    modifiedAt: timestamp,
  };
}

// Windows paths may contain characters path.parse handles fine, but keep a
// single seam here in case future storage-path shapes need normalizing.
function destNameSafe(storedPath: string): string {
  return path.basename(storedPath);
}

interface RegisterDeps {
  logger: Logger;
  settingsRepo: SettingsRepository;
  getWindow: () => BrowserWindow | null;
}

export function registerAssetsIpc({ logger, settingsRepo, getWindow }: RegisterDeps): void {
  ipcMain.handle(
    "assets:choose-files",
    async (): Promise<string[] | null> => {
      const win = getWindow();
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile", "multiSelections"],
        title: "Choose files to add to the Asset Library",
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths;
    },
  );

  ipcMain.handle(
    "assets:import",
    async (
      _event,
      args: { projectDir: string; filePaths: string[]; category: AssetCategory; storageMode: "managed" | "linked" },
    ) => {
      try {
        const manifest = readManifest(args.projectDir);
        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const added: Asset[] = [];
        const duplicates: Array<{ fileName: string; existingAssetId: string }> = [];

        for (const filePath of args.filePaths) {
          const checksum = await computeFileChecksum(filePath);
          const existing = manifest.assets.find((a) => a.checksumSha256 === checksum);
          if (existing) {
            duplicates.push({ fileName: path.basename(filePath), existingAssetId: existing.id });
            continue;
          }
          const asset = await buildAssetFromFile(
            args.projectDir,
            filePath,
            args.category,
            args.storageMode,
            ffmpegOverridePath,
            logger,
          );
          added.push(asset);
        }

        const updatedManifest = { ...manifest, assets: [...manifest.assets, ...added] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, added: added.length, duplicates };
      } catch (error) {
        logger.error("assets:import failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle("assets:check-missing", (_event, projectDir: string) => {
    try {
      const manifest = readManifest(projectDir);
      const missingIds = manifest.assets
        .filter((a) => !fs.existsSync(resolveAssetPath(projectDir, a)))
        .map((a) => a.id);
      return { ok: true as const, missingIds };
    } catch (error) {
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("assets:relink", async (_event, projectDir: string, assetId: string) => {
    const win = getWindow();
    if (!win) return { ok: false as const, error: { title: "No window", detail: "Application window unavailable." } };
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      title: "Locate the missing file",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false as const, canceled: true as const };
    }
    try {
      const manifest = readManifest(projectDir);
      const asset = manifest.assets.find((a) => a.id === assetId);
      if (!asset) return { ok: false as const, error: { title: "Asset not found", detail: assetId } };
      const newPath = result.filePaths[0]!;
      const checksumSha256 = await computeFileChecksum(newPath);
      const updatedAsset: Asset = {
        ...asset,
        filePath: asset.storageMode === "linked" ? newPath : asset.filePath,
        checksumSha256,
        modifiedAt: nowIso(),
      };
      const updatedManifest = {
        ...manifest,
        assets: manifest.assets.map((a) => (a.id === assetId ? updatedAsset : a)),
      };
      const saved = saveProject(projectDir, updatedManifest);
      return { ok: true as const, manifest: saved };
    } catch (error) {
      logger.error("assets:relink failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("assets:remove", (_event, projectDir: string, assetId: string) => {
    try {
      const manifest = readManifest(projectDir);
      const asset = manifest.assets.find((a) => a.id === assetId);
      if (!asset) return { ok: false as const, error: { title: "Asset not found", detail: assetId } };

      // Only ever delete files this app itself copied ("managed"). Linked
      // originals belong to the user and must never be touched.
      if (asset.storageMode === "managed") {
        const absolute = resolveAssetPath(projectDir, asset);
        if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
        for (const preview of [asset.thumbnailPath, asset.waveformImagePath]) {
          if (preview) {
            const previewAbs = path.join(projectDir, preview);
            if (fs.existsSync(previewAbs)) fs.unlinkSync(previewAbs);
          }
        }
      }

      const updatedManifest = { ...manifest, assets: manifest.assets.filter((a) => a.id !== assetId) };
      const saved = saveProject(projectDir, updatedManifest);
      return { ok: true as const, manifest: saved };
    } catch (error) {
      logger.error("assets:remove failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("assets:update-metadata", (_event, projectDir: string, assetId: string, patch: Partial<Asset>) => {
    try {
      const manifest = readManifest(projectDir);
      const updatedManifest = {
        ...manifest,
        assets: manifest.assets.map((a) => (a.id === assetId ? { ...a, ...patch, modifiedAt: nowIso() } : a)),
      };
      const saved = saveProject(projectDir, updatedManifest);
      return { ok: true as const, manifest: saved };
    } catch (error) {
      logger.error("assets:update-metadata failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("assets:reveal", (_event, projectDir: string, assetId: string) => {
    try {
      const manifest = readManifest(projectDir);
      const asset = manifest.assets.find((a) => a.id === assetId);
      if (!asset) return { ok: false as const, error: { title: "Asset not found", detail: assetId } };
      shell.showItemInFolder(resolveAssetPath(projectDir, asset));
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("ffmpeg:status", async () => {
    const overridePath = settingsRepo.get().ffmpegPath;
    return checkFfmpegStatus(overridePath);
  });
}
