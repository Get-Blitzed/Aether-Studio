import fs from "node:fs";
import path from "node:path";
import { ipcMain, dialog, shell, type BrowserWindow } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import { nowIso, type Logger } from "@aether/core";
import { computeFileChecksum, checkFfmpegStatus } from "@aether/media-engine";
import type { Asset, AssetCategory } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { buildAssetFromFile, resolveAssetPath } from "../assetBuilder.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Asset error", detail: error.message };
  return { title: "Asset error", detail: String(error) };
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
