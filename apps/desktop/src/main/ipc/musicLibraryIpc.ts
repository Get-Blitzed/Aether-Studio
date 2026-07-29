import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import type { Logger } from "@aether/core";
import { computeFileChecksum } from "@aether/media-engine";
import type { Asset } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { getMusicLibraryDir } from "../resourcePaths.js";
import { buildAssetFromFile } from "../assetBuilder.js";

export interface MusicLibraryEntry {
  id: string;
  title: string;
  filePath: string;
  mood: string;
  moodLabel: string;
  durationSeconds: number | null;
  attribution: string;
}

/** What the renderer actually receives -- adds the resolved absolute path for audio preview, since only the main process can resolve the bundled-resources directory. */
export interface MusicLibraryEntryWithAbsolutePath extends MusicLibraryEntry {
  absolutePath: string;
}

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Music Library error", detail: error.message };
  return { title: "Music Library error", detail: String(error) };
}

/**
 * A curated, bundled set of CC-BY 4.0 background music tracks (Kevin
 * MacLeod / incompetech.com -- see resources/music-library/ATTRIBUTIONS.md),
 * browsable from any project and imported into the Asset Library on
 * demand, mirroring the Sound Library's list/import pattern exactly.
 * Unlike the sound effects, CC-BY requires attribution -- each entry's
 * `attribution` string is surfaced in the UI next to the track and copied
 * onto the imported Asset's notes.
 */
export function registerMusicLibraryIpc({ logger, settingsRepo }: { logger: Logger; settingsRepo: SettingsRepository }): void {
  ipcMain.handle("music-library:list", () => {
    try {
      const libraryDir = getMusicLibraryDir();
      const manifestPath = path.join(libraryDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return { ok: true as const, entries: [] as MusicLibraryEntryWithAbsolutePath[] };
      }
      const entries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as MusicLibraryEntry[];
      const withPaths: MusicLibraryEntryWithAbsolutePath[] = entries.map((entry) => ({
        ...entry,
        absolutePath: path.join(libraryDir, entry.filePath),
      }));
      return { ok: true as const, entries: withPaths };
    } catch (error) {
      logger.error("music-library:list failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle(
    "music-library:import",
    async (_event, args: { projectDir: string; entryIds: string[] }) => {
      try {
        const libraryDir = getMusicLibraryDir();
        const manifestPath = path.join(libraryDir, "manifest.json");
        const entries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as MusicLibraryEntry[];

        const manifest = readManifest(args.projectDir);
        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const added: Asset[] = [];
        const duplicates: string[] = [];

        for (const entryId of args.entryIds) {
          const entry = entries.find((e) => e.id === entryId);
          if (!entry) continue;
          const sourcePath = path.join(libraryDir, entry.filePath);
          if (!fs.existsSync(sourcePath)) continue;

          const checksum = await computeFileChecksum(sourcePath);
          const existing = manifest.assets.find((a) => a.checksumSha256 === checksum);
          if (existing) {
            duplicates.push(entry.title);
            continue;
          }

          const asset = await buildAssetFromFile(args.projectDir, sourcePath, "music", "managed", ffmpegOverridePath, logger);
          added.push({ ...asset, tags: [entry.mood], notes: `Imported from the bundled Music Library. ${entry.attribution}` });
        }

        const updatedManifest = { ...manifest, assets: [...manifest.assets, ...added] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, added: added.length, duplicates };
      } catch (error) {
        logger.error("music-library:import failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );
}
