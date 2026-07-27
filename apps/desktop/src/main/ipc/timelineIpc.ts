import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import type { Logger } from "@aether/core";
import { concatVideoClips } from "@aether/media-engine";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { buildAssetFromFile, resolveAssetPath } from "../assetBuilder.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Timeline error", detail: error.message };
  return { title: "Timeline error", detail: String(error) };
}

interface RegisterDeps {
  logger: Logger;
  settingsRepo: SettingsRepository;
}

export function registerTimelineIpc({ logger, settingsRepo }: RegisterDeps): void {
  ipcMain.handle(
    "timeline:render-preview",
    async (_event, args: { projectDir: string; timelineId: string }) => {
      try {
        const manifest = readManifest(args.projectDir);
        const timeline = manifest.timelines.find((t) => t.id === args.timelineId);
        if (!timeline) return { ok: false as const, error: { title: "Timeline not found", detail: args.timelineId } };

        const primaryTrack = timeline.tracks.find((t) => t.type === "primary-video");
        if (!primaryTrack) {
          return {
            ok: false as const,
            error: { title: "No primary video track", detail: "Add a Primary Video track with at least one clip first." },
          };
        }
        const clips = timeline.clips
          .filter((c) => c.trackId === primaryTrack.id && c.assetId)
          .sort((a, b) => a.timelineStartSeconds - b.timelineStartSeconds);
        if (clips.length === 0) {
          return {
            ok: false as const,
            error: { title: "Primary video track is empty", detail: "Add at least one clip before rendering a preview." },
          };
        }

        const segments = clips.map((clip) => {
          const asset = manifest.assets.find((a) => a.id === clip.assetId);
          if (!asset) throw new Error(`Clip references a missing asset: ${clip.assetId}`);
          return {
            filePath: resolveAssetPath(args.projectDir, asset),
            startSeconds: clip.sourceInSeconds,
            endSeconds: clip.sourceOutSeconds ?? asset.durationSeconds ?? clip.sourceInSeconds + clip.timelineDurationSeconds,
          };
        });

        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const rendersDir = path.join(args.projectDir, "renders");
        fs.mkdirSync(rendersDir, { recursive: true });
        const tempOutput = path.join(rendersDir, `preview-${Date.now()}.mp4`);
        await concatVideoClips(segments, tempOutput, { ffmpegOverridePath });

        const asset = await buildAssetFromFile(args.projectDir, tempOutput, "exports", "managed", ffmpegOverridePath, logger);
        fs.unlinkSync(tempOutput);
        const namedAsset = {
          ...asset,
          notes: `Quick preview render of timeline "${timeline.name}" (primary video track only, no audio/overlays).`,
        };

        const updatedManifest = { ...manifest, assets: [...manifest.assets, namedAsset] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, assetId: namedAsset.id };
      } catch (error) {
        logger.error("timeline:render-preview failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );
}
