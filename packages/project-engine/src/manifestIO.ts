import fs from "node:fs";
import path from "node:path";
import {
  ProjectManifestSchema,
  AETHER_PROJECT_FORMAT_VERSION,
  type ProjectManifest,
} from "@aether/shared-types";
import { PROJECT_MANIFEST_FILENAME } from "./projectStructure.js";
import { ProjectEngineError } from "./errors.js";

export function manifestPathFor(projectDir: string): string {
  return path.join(projectDir, PROJECT_MANIFEST_FILENAME);
}

/**
 * Writes the manifest atomically: serialize -> write to a temp file in the
 * same directory -> rename over the real file. A crash mid-write leaves the
 * previous valid manifest untouched, since rename is the only step that
 * mutates project.aether itself.
 */
export function writeManifestAtomic(projectDir: string, manifest: ProjectManifest): void {
  const validated = ProjectManifestSchema.parse(manifest);
  const targetPath = manifestPathFor(projectDir);
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  const serialized = JSON.stringify(validated, null, 2);
  fs.writeFileSync(tempPath, serialized, "utf-8");
  fs.renameSync(tempPath, targetPath);
}

export function readManifest(projectDir: string): ProjectManifest {
  const targetPath = manifestPathFor(projectDir);
  if (!fs.existsSync(targetPath)) {
    throw new ProjectEngineError(
      `No project.aether manifest found at ${targetPath}`,
      "MANIFEST_NOT_FOUND",
    );
  }
  let raw: string;
  try {
    raw = fs.readFileSync(targetPath, "utf-8");
  } catch (cause) {
    throw new ProjectEngineError(`Unable to read manifest at ${targetPath}`, "MANIFEST_INVALID", cause);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new ProjectEngineError(
      `Manifest at ${targetPath} is not valid JSON. The project may be corrupted; try restoring a backup.`,
      "MANIFEST_INVALID",
      cause,
    );
  }
  const formatVersion = (parsed as { formatVersion?: number }).formatVersion;
  if (typeof formatVersion === "number" && formatVersion > AETHER_PROJECT_FORMAT_VERSION) {
    throw new ProjectEngineError(
      `This project was saved by a newer version of Aether Studio Suite (format v${formatVersion}). Update the application to open it.`,
      "MANIFEST_VERSION_UNSUPPORTED",
    );
  }
  const result = ProjectManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new ProjectEngineError(
      `Manifest at ${targetPath} failed validation: ${result.error.message}`,
      "MANIFEST_INVALID",
      result.error,
    );
  }
  return result.data;
}
