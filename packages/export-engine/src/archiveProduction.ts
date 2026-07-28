import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { ExportEngineError } from "./errors.js";

/**
 * Bundles a project folder (manifest, assets, renders, everything) into a
 * single .zip for backup or handoff -- the spec's "production archive"
 * requirement. `adm-zip` is a pure-JS zip library (no native compilation),
 * consistent with every other dependency choice in this codebase.
 */
export function archiveProduction(projectDir: string, outputZipPath: string): void {
  if (!fs.existsSync(projectDir)) {
    throw new ExportEngineError(`Project directory does not exist: ${projectDir}`, "ARCHIVE_FAILED");
  }
  try {
    const zip = new AdmZip();
    // Exclude regenerable preview thumbnails/waveforms and previously-created
    // archives themselves -- otherwise re-running this against the same
    // project nests every prior archive inside the next one.
    zip.addLocalFolder(projectDir, "", (entryPath) => !entryPath.startsWith("cache") && !entryPath.startsWith("archives"));
    fs.mkdirSync(path.dirname(outputZipPath), { recursive: true });
    zip.writeZip(outputZipPath);
  } catch (cause) {
    throw new ExportEngineError("Failed to create the production archive.", "ARCHIVE_FAILED", cause);
  }
}
