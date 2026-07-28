import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import type { Logger } from "@aether/core";
import { nowIso } from "@aether/core";
import { EXPORT_PRESETS, getExportPreset, runQualityChecklist, renderFinalExport, archiveProduction, ExportEngineError } from "@aether/export-engine";
import { isAudioTrackType } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { buildAssetFromFile, resolveAssetPath } from "../assetBuilder.js";

function toAppError(error: unknown): AppError {
  if (error instanceof ExportEngineError) return { title: "Export error", detail: error.message, code: error.code };
  if (error instanceof Error) return { title: "Export error", detail: error.message };
  return { title: "Export error", detail: String(error) };
}

interface RegisterDeps {
  logger: Logger;
  settingsRepo: SettingsRepository;
}

export function registerExportIpc({ logger, settingsRepo }: RegisterDeps): void {
  ipcMain.handle("export:list-presets", () => EXPORT_PRESETS);

  ipcMain.handle("export:run-quality-checklist", (_event, projectDir: string) => {
    try {
      const manifest = readManifest(projectDir);
      return { ok: true as const, checks: runQualityChecklist(manifest) };
    } catch (error) {
      logger.error("export:run-quality-checklist failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle(
    "export:render",
    async (_event, args: { projectDir: string; timelineId: string; presetId: string }) => {
      try {
        const preset = getExportPreset(args.presetId);
        if (!preset) return { ok: false as const, error: { title: "Unknown export preset", detail: args.presetId } };

        const manifest = readManifest(args.projectDir);
        const timeline = manifest.timelines.find((t) => t.id === args.timelineId);
        if (!timeline) return { ok: false as const, error: { title: "Timeline not found", detail: args.timelineId } };

        const primaryTrackIds = new Set(timeline.tracks.filter((t) => t.type === "primary-video").map((t) => t.id));
        const videoClips = timeline.clips
          .filter((c) => primaryTrackIds.has(c.trackId) && c.assetId)
          .sort((a, b) => a.timelineStartSeconds - b.timelineStartSeconds);
        if (videoClips.length === 0) {
          return {
            ok: false as const,
            error: { title: "No primary video clips", detail: "Add at least one clip to a Primary Video track before exporting." },
          };
        }

        const videoSegments = videoClips.map((clip) => {
          const asset = manifest.assets.find((a) => a.id === clip.assetId);
          if (!asset) throw new Error(`Clip references a missing asset: ${clip.assetId}`);
          return {
            filePath: resolveAssetPath(args.projectDir, asset),
            startSeconds: clip.sourceInSeconds,
            endSeconds: clip.sourceOutSeconds ?? asset.durationSeconds ?? clip.sourceInSeconds + clip.timelineDurationSeconds,
          };
        });

        const audioTrackIds = new Set(timeline.tracks.filter((t) => isAudioTrackType(t.type)).map((t) => t.id));
        const audioClips = timeline.clips
          .filter((c) => audioTrackIds.has(c.trackId) && c.assetId)
          .map((clip) => {
            const asset = manifest.assets.find((a) => a.id === clip.assetId);
            if (!asset) throw new Error(`Clip references a missing asset: ${clip.assetId}`);
            return {
              filePath: resolveAssetPath(args.projectDir, asset),
              timelineStartSeconds: clip.timelineStartSeconds,
              sourceInSeconds: clip.sourceInSeconds,
              durationSeconds: clip.timelineDurationSeconds,
              volume: clip.volume,
              fadeInSeconds: clip.fadeInSeconds,
              fadeOutSeconds: clip.fadeOutSeconds,
            };
          });

        const captions = manifest.captions.map((c) => ({ startSeconds: c.startSeconds, endSeconds: c.endSeconds, text: c.text }));

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const rendersDir = path.join(args.projectDir, "renders");
        fs.mkdirSync(rendersDir, { recursive: true });
        const tempOutput = path.join(rendersDir, `export-${preset.id}-${Date.now()}.mp4`);

        await renderFinalExport({ videoSegments, audioClips, captions, preset }, tempOutput);

        const asset = await buildAssetFromFile(args.projectDir, tempOutput, "exports", "managed", ffmpegOverridePath, logger);
        fs.unlinkSync(tempOutput);
        const notedAsset = {
          ...asset,
          notes: `Final export of timeline "${timeline.name}" at ${preset.name} (${preset.width}x${preset.height}).`,
        };

        const updatedManifest = { ...manifest, assets: [...manifest.assets, notedAsset], modifiedAt: nowIso() };
        const savedManifest = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: savedManifest, assetId: notedAsset.id };
      } catch (error) {
        logger.error("export:render failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle("export:create-archive", (_event, projectDir: string) => {
    try {
      const archivesDir = path.join(projectDir, "archives");
      const zipPath = path.join(archivesDir, `production-archive-${Date.now()}.zip`);
      archiveProduction(projectDir, zipPath);
      return { ok: true as const, archivePath: zipPath };
    } catch (error) {
      logger.error("export:create-archive failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });
}
