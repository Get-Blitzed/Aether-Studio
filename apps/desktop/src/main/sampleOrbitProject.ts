import fs from "node:fs";
import path from "node:path";
import type { Logger } from "@aether/core";
import { createProject, saveProject, readManifest } from "@aether/project-engine";
import type { ProjectManifest } from "@aether/shared-types";
import { getNovaCharacterSheetSourcePath } from "./resourcePaths.js";
import { buildNovaCharacter, buildOrbitBrand, buildMission001Script } from "./sampleOrbitData.js";

const SAMPLE_TITLE = "Orbit - Mission 001 - Welcome to Orbit";

export interface SampleProjectResult {
  projectId: string;
  projectDir: string;
  manifest: ProjectManifest;
  characterSheetImported: boolean;
}

/**
 * Idempotent: if the sample project already exists under parentDir, opens it
 * as-is (never overwrites a user's edits to the sample). Otherwise creates it
 * fresh, seeded with the Nova character, Orbit brand, and the Mission 001
 * script, and copies the character sheet image if it is present on disk.
 */
export function ensureOrbitSampleProject(parentDir: string, applicationVersion: string, logger: Logger): SampleProjectResult {
  const expectedDir = path.join(parentDir, SAMPLE_TITLE);

  if (fs.existsSync(path.join(expectedDir, "project.aether"))) {
    const manifest = readManifest(expectedDir);
    logger.info("Opened existing Orbit sample project", { expectedDir });
    return {
      projectId: manifest.projectId,
      projectDir: expectedDir,
      manifest,
      characterSheetImported: manifest.characters[0]?.references.length ? true : false,
    };
  }

  const character = buildNovaCharacter();
  const brand = buildOrbitBrand();
  const script = buildMission001Script();

  const created = createProject({
    parentDir,
    title: SAMPLE_TITLE,
    applicationVersion,
    description:
      "Sample production: introduces the Orbit platform and Nova, the onboarding guide, for the recurring Mission series.",
    productionSettings: {
      productName: "Orbit",
      productionType: "course-lesson",
      series: "Orbit Missions",
      episode: "Mission 001",
      targetAudience: "New Orbit users",
      primaryObjective: "Introduce the platform and establish Nova as the onboarding guide.",
      targetDurationSeconds: 420,
      aspectRatio: "16:9",
      frameRate: 30,
      stage: "script",
    },
  });

  let characterSheetImported = false;
  const sourceImagePath = getNovaCharacterSheetSourcePath();
  if (fs.existsSync(sourceImagePath)) {
    const charactersDir = path.join(created.projectDir, "characters");
    fs.mkdirSync(charactersDir, { recursive: true });
    const destPath = path.join(charactersDir, "nova-character-sheet.svg");
    fs.copyFileSync(sourceImagePath, destPath);
    character.references.push({
      id: `charref_${Date.now()}`,
      category: "full-body-view",
      filePath: path.join("characters", "nova-character-sheet.svg"),
      approved: false,
      notes: "Imported automatically from bundled sample resources.",
      tags: ["sample", "character-sheet"],
      createdAt: new Date().toISOString(),
    });
    characterSheetImported = true;
    logger.info("Imported Nova character sheet into sample project", { destPath });
  } else {
    logger.warn("Nova character sheet not found in bundled resources; skipping auto-import", {
      sourceImagePath,
    });
  }

  const manifest: ProjectManifest = {
    ...created.manifest,
    characters: [character],
    brands: [brand],
    scripts: [script],
  };

  const saved = saveProject(created.projectDir, manifest, { skipBackup: true });

  return {
    projectId: created.projectId,
    projectDir: created.projectDir,
    manifest: saved,
    characterSheetImported,
  };
}
