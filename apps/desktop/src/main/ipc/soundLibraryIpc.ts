import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import type { Logger } from "@aether/core";
import { computeFileChecksum } from "@aether/media-engine";
import type { Asset } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { getSoundLibraryDir } from "../resourcePaths.js";
import { buildAssetFromFile } from "../assetBuilder.js";

export interface SoundLibraryEntry {
  id: string;
  filePath: string;
  title: string;
  category: string;
  categoryLabel: string;
  durationSeconds: number | null;
  originalFileName: string;
}

/** What the renderer actually receives -- adds the resolved absolute path for audio preview, since only the main process can resolve the bundled-resources directory. */
export interface SoundLibraryEntryWithAbsolutePath extends SoundLibraryEntry {
  absolutePath: string;
}

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Sound Library error", detail: error.message };
  return { title: "Sound Library error", detail: String(error) };
}

/**
 * A curated, bundled set of royalty-free sound effects (see
 * resources/sound-library/manifest.json), browsable from any project and
 * imported into the Asset Library on demand -- nothing is copied into a
 * project until the user picks it, unlike the Orbit sample project's
 * auto-copy-on-create pattern. Kept deliberately small (a curated subset,
 * not the full source pack) to keep the installer lean; see
 * KNOWN_LIMITATIONS.md.
 */
export function registerSoundLibraryIpc({ logger, settingsRepo }: { logger: Logger; settingsRepo: SettingsRepository }): void {
  ipcMain.handle("sound-library:list", () => {
    try {
      const libraryDir = getSoundLibraryDir();
      const manifestPath = path.join(libraryDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return { ok: true as const, entries: [] as SoundLibraryEntryWithAbsolutePath[] };
      }
      const entries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as SoundLibraryEntry[];
      const withPaths: SoundLibraryEntryWithAbsolutePath[] = entries.map((entry) => ({
        ...entry,
        absolutePath: path.join(libraryDir, entry.filePath),
      }));
      return { ok: true as const, entries: withPaths };
    } catch (error) {
      logger.error("sound-library:list failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle(
    "sound-library:import",
    async (_event, args: { projectDir: string; entryIds: string[] }) => {
      try {
        const libraryDir = getSoundLibraryDir();
        const manifestPath = path.join(libraryDir, "manifest.json");
        const entries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as SoundLibraryEntry[];

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

          const asset = await buildAssetFromFile(args.projectDir, sourcePath, "sound-effects", "managed", ffmpegOverridePath, logger);
          added.push({ ...asset, tags: [entry.category], notes: `Imported from the bundled Sound Library (${entry.categoryLabel}).` });
        }

        const updatedManifest = { ...manifest, assets: [...manifest.assets, ...added] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, added: added.length, duplicates };
      } catch (error) {
        logger.error("sound-library:import failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );
}
