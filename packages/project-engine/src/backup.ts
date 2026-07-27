import fs from "node:fs";
import path from "node:path";
import { manifestPathFor } from "./manifestIO.js";
import { ProjectEngineError } from "./errors.js";

function backupsDirFor(projectDir: string): string {
  return path.join(projectDir, "backups");
}

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

/**
 * Snapshots the current project.aether into /backups before a risky
 * operation (save, migration). Rotates to keep at most `keep` snapshots --
 * oldest deleted only after the new snapshot is confirmed written, so a
 * failure here never leaves zero backups.
 */
export function createBackupSnapshot(projectDir: string, keep = 10): string {
  const manifestPath = manifestPathFor(projectDir);
  if (!fs.existsSync(manifestPath)) {
    throw new ProjectEngineError(
      `Cannot back up: no manifest exists yet at ${manifestPath}`,
      "MANIFEST_NOT_FOUND",
    );
  }
  const dir = backupsDirFor(projectDir);
  fs.mkdirSync(dir, { recursive: true });
  const snapshotName = `project.aether.${timestampForFilename(new Date())}.bak`;
  const snapshotPath = path.join(dir, snapshotName);
  fs.copyFileSync(manifestPath, snapshotPath);

  const existing = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".bak"))
    .sort();
  const excess = existing.length - keep;
  if (excess > 0) {
    for (const file of existing.slice(0, excess)) {
      fs.unlinkSync(path.join(dir, file));
    }
  }

  return snapshotPath;
}

export function listBackupSnapshots(projectDir: string): string[] {
  const dir = backupsDirFor(projectDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".bak"))
    .sort()
    .reverse();
}

/**
 * Restores a backup snapshot. The manifest currently on disk is itself
 * snapshotted first, so restoring is reversible even if the wrong backup is
 * picked.
 */
export function restoreBackupSnapshot(projectDir: string, backupFileName: string): void {
  const dir = backupsDirFor(projectDir);
  const backupPath = path.join(dir, backupFileName);
  if (!fs.existsSync(backupPath)) {
    throw new ProjectEngineError(`Backup not found: ${backupFileName}`, "BACKUP_NOT_FOUND");
  }
  const manifestPath = manifestPathFor(projectDir);
  if (fs.existsSync(manifestPath)) {
    createBackupSnapshot(projectDir);
  }
  const tempPath = `${manifestPath}.tmp-restore-${Date.now()}`;
  fs.copyFileSync(backupPath, tempPath);
  fs.renameSync(tempPath, manifestPath);
}
