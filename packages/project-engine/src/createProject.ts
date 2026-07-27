import fs from "node:fs";
import path from "node:path";
import { generateId, nowIso, sanitizeFileName } from "@aether/core";
import { ProjectManifestSchema, type ProjectManifest, type ProductionSettings } from "@aether/shared-types";
import { PROJECT_SUBDIRECTORIES } from "./projectStructure.js";
import { writeManifestAtomic, manifestPathFor } from "./manifestIO.js";
import { ProjectEngineError } from "./errors.js";

export interface CreateProjectOptions {
  parentDir: string;
  title: string;
  applicationVersion: string;
  description?: string;
  productionSettings?: Partial<ProductionSettings>;
}

export interface CreatedProject {
  projectId: string;
  projectDir: string;
  manifest: ProjectManifest;
}

/**
 * Scaffolds a new project directory with the standard Aether subfolders and
 * writes an initial validated project.aether. Refuses to reuse an existing
 * non-empty directory so a new project can never silently overwrite one.
 */
export function createProject(options: CreateProjectOptions): CreatedProject {
  const folderName = sanitizeFileName(options.title, "untitled-production");
  const projectDir = path.join(options.parentDir, folderName);

  if (fs.existsSync(projectDir)) {
    const existingEntries = fs.readdirSync(projectDir);
    if (existingEntries.length > 0) {
      throw new ProjectEngineError(
        `A folder named "${folderName}" already exists and is not empty: ${projectDir}`,
        "PROJECT_DIR_EXISTS",
      );
    }
  }

  fs.mkdirSync(projectDir, { recursive: true });
  for (const sub of PROJECT_SUBDIRECTORIES) {
    fs.mkdirSync(path.join(projectDir, sub), { recursive: true });
  }

  const timestamp = nowIso();
  const projectId = generateId("proj");
  const manifest: ProjectManifest = ProjectManifestSchema.parse({
    applicationVersion: options.applicationVersion,
    projectId,
    title: options.title,
    description: options.description,
    createdAt: timestamp,
    modifiedAt: timestamp,
    productionSettings: options.productionSettings ?? {},
  });

  writeManifestAtomic(projectDir, manifest);

  return { projectId, projectDir, manifest };
}

export function projectManifestPath(projectDir: string): string {
  return manifestPathFor(projectDir);
}
