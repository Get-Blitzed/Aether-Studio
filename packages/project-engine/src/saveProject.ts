import { nowIso } from "@aether/core";
import type { ProjectManifest } from "@aether/shared-types";
import { writeManifestAtomic } from "./manifestIO.js";
import { createBackupSnapshot } from "./backup.js";

export interface SaveProjectOptions {
  backupCount?: number;
  skipBackup?: boolean;
}

/**
 * Saves a project: snapshot the previous manifest (unless explicitly
 * skipped, e.g. for autosave ticks with no changes), bump modifiedAt, then
 * write atomically.
 */
export function saveProject(
  projectDir: string,
  manifest: ProjectManifest,
  options: SaveProjectOptions = {},
): ProjectManifest {
  if (!options.skipBackup) {
    try {
      createBackupSnapshot(projectDir, options.backupCount ?? 10);
    } catch {
      // No existing manifest to back up yet (first save) -- fine to proceed.
    }
  }
  const updated: ProjectManifest = { ...manifest, modifiedAt: nowIso() };
  writeManifestAtomic(projectDir, updated);
  return updated;
}
