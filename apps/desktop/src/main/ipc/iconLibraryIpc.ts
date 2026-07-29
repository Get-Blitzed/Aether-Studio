import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import type { Logger } from "@aether/core";
import { computeFileChecksum } from "@aether/media-engine";
import type { Asset } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { getIconsDir } from "../resourcePaths.js";
import { buildAssetFromFile } from "../assetBuilder.js";

export interface IconLibraryEntry {
  id: string;
  title: string;
  filePath: string;
  tags: string[];
}

/** What the renderer actually receives -- adds the resolved absolute path for `<img>` preview, since only the main process can resolve the bundled-resources directory. */
export interface IconLibraryEntryWithAbsolutePath extends IconLibraryEntry {
  absolutePath: string;
}

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Icon Library error", detail: error.message };
  return { title: "Icon Library error", detail: String(error) };
}

/**
 * A curated, bundled set of MIT-licensed Feather Icons SVGs (see
 * resources/icons/LICENSE.txt), browsable from any project and imported
 * into the Asset Library's "graphics" category on demand, mirroring the
 * Sound/Music Library's list/import pattern exactly.
 */
export function registerIconLibraryIpc({ logger, settingsRepo }: { logger: Logger; settingsRepo: SettingsRepository }): void {
  ipcMain.handle("icon-library:list", () => {
    try {
      const libraryDir = getIconsDir();
      const manifestPath = path.join(libraryDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return { ok: true as const, entries: [] as IconLibraryEntryWithAbsolutePath[] };
      }
      const entries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as IconLibraryEntry[];
      const withPaths: IconLibraryEntryWithAbsolutePath[] = entries.map((entry) => ({
        ...entry,
        absolutePath: path.join(libraryDir, entry.filePath),
      }));
      return { ok: true as const, entries: withPaths };
    } catch (error) {
      logger.error("icon-library:list failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle(
    "icon-library:import",
    async (_event, args: { projectDir: string; entryIds: string[] }) => {
      try {
        const libraryDir = getIconsDir();
        const manifestPath = path.join(libraryDir, "manifest.json");
        const entries = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as IconLibraryEntry[];

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

          const asset = await buildAssetFromFile(args.projectDir, sourcePath, "graphics", "managed", ffmpegOverridePath, logger);
          added.push({ ...asset, tags: entry.tags, notes: "Imported from the bundled Icon Library (Feather Icons, MIT)." });
        }

        const updatedManifest = { ...manifest, assets: [...manifest.assets, ...added] };
        const saved = saveProject(args.projectDir, updatedManifest);
        return { ok: true as const, manifest: saved, added: added.length, duplicates };
      } catch (error) {
        logger.error("icon-library:import failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );
}
