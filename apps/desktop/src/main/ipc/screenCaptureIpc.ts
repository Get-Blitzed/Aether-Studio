import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ipcMain, desktopCapturer } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import { nowIso, type Logger } from "@aether/core";
import { trimVideo, adjustVideoSpeed, probeMedia, generateVideoThumbnail } from "@aether/media-engine";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { buildAssetFromFile } from "../assetBuilder.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Screen Capture error", detail: error.message };
  return { title: "Screen Capture error", detail: String(error) };
}

export interface CaptureSourceInfo {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  kind: "screen" | "window";
}

interface RegisterDeps {
  logger: Logger;
  settingsRepo: SettingsRepository;
}

export function registerScreenCaptureIpc({ logger, settingsRepo }: RegisterDeps): void {
  ipcMain.handle("screencapture:list-sources", async (): Promise<CaptureSourceInfo[]> => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnailDataUrl: s.thumbnail.toDataURL(),
      kind: s.id.startsWith("screen:") ? "screen" : "window",
    }));
  });

  ipcMain.handle(
    "screencapture:save-recording",
    async (
      _event,
      args: {
        projectDir: string;
        data: ArrayBuffer;
        fileExtension: string;
        sourceKind: "screen" | "window";
        micEnabled: boolean;
        systemAudioEnabled: boolean;
        privacyChecklistAcknowledged: boolean;
        scriptSegmentId?: string;
        notes?: string;
      },
    ) => {
      if (!args.privacyChecklistAcknowledged) {
        return {
          ok: false as const,
          error: {
            title: "Privacy checklist required",
            detail: "Confirm every item on the privacy checklist before a recording can be saved.",
          },
        };
      }
      try {
        const tempPath = path.join(os.tmpdir(), `aether-capture-${Date.now()}.${args.fileExtension}`);
        fs.writeFileSync(tempPath, Buffer.from(args.data));

        const manifest = readManifest(args.projectDir);
        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const asset = await buildAssetFromFile(
          args.projectDir,
          tempPath,
          "screen-recordings",
          "managed",
          ffmpegOverridePath,
          logger,
        );
        fs.unlinkSync(tempPath);

        const annotatedAsset = {
          ...asset,
          notes: [
            `Captured: ${args.sourceKind}`,
            `Microphone: ${args.micEnabled ? "on" : "off"}`,
            `System audio: ${args.systemAudioEnabled ? "on (best effort)" : "off"}`,
            args.notes,
          ]
            .filter(Boolean)
            .join(" | "),
        };

        const updatedManifest = { ...manifest, assets: [...manifest.assets, annotatedAsset] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, assetId: annotatedAsset.id };
      } catch (error) {
        logger.error("screencapture:save-recording failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle(
    "screencapture:process-clip",
    async (
      _event,
      args:
        | { projectDir: string; assetId: string; action: "trim"; trimStartSeconds: number; trimEndSeconds: number }
        | { projectDir: string; assetId: string; action: "speed"; speedFactor: number },
    ) => {
      try {
        const manifest = readManifest(args.projectDir);
        const asset = manifest.assets.find((a) => a.id === args.assetId);
        if (!asset) return { ok: false as const, error: { title: "Asset not found", detail: args.assetId } };

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const absolute = path.join(args.projectDir, asset.filePath);
        const tempOutput = `${absolute}.processing-${Date.now()}${path.extname(absolute)}`;

        if (args.action === "trim") {
          await trimVideo(absolute, tempOutput, args.trimStartSeconds, args.trimEndSeconds, ffmpegOverridePath);
        } else {
          await adjustVideoSpeed(absolute, tempOutput, args.speedFactor, ffmpegOverridePath);
        }
        fs.renameSync(tempOutput, absolute);

        const probe = await probeMedia(absolute, ffmpegOverridePath).catch(() => undefined);
        let thumbnailPath = asset.thumbnailPath;
        if (asset.thumbnailPath) {
          try {
            await generateVideoThumbnail(absolute, path.join(args.projectDir, asset.thumbnailPath), {
              ffmpegOverridePath,
            });
          } catch {
            // Keep the stale thumbnail rather than fail the whole operation over a preview image.
          }
        }

        const updatedAsset = {
          ...asset,
          durationSeconds: probe?.durationSeconds ?? asset.durationSeconds,
          thumbnailPath,
          modifiedAt: nowIso(),
        };
        const updatedManifest = {
          ...manifest,
          assets: manifest.assets.map((a) => (a.id === args.assetId ? updatedAsset : a)),
        };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved };
      } catch (error) {
        logger.error("screencapture:process-clip failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );
}
