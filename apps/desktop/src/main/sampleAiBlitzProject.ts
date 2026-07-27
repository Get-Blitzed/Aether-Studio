import fs from "node:fs";
import path from "node:path";
import type { Logger } from "@aether/core";
import { createProject, saveProject, readManifest } from "@aether/project-engine";
import type { ProjectManifest } from "@aether/shared-types";
import { getBlitzCharacterSheetSourcePath } from "./resourcePaths.js";
import { buildBlitzCharacter, buildAiBlitzBrand, buildMission001Script } from "./sampleAiBlitzData.js";

const SAMPLE_TITLE = "A.I. Blitz - Mission 001 - Welcome to A.I. Blitz";

export interface SampleProjectResult {
  projectId: string;
  projectDir: string;
  manifest: ProjectManifest;
  characterSheetImported: boolean;
}

/**
 * Idempotent: if the sample project already exists under parentDir, opens it
 * as-is (never overwrites a user's edits to the sample). Otherwise creates it
 * fresh, seeded with the Blitz character, A.I. Blitz brand, and the Mission
 * 001 script, and copies the character sheet image if it is present on disk.
 */
export function ensureAiBlitzSampleProject(parentDir: string, applicationVersion: string, logger: Logger): SampleProjectResult {
  const expectedDir = path.join(parentDir, SAMPLE_TITLE);

  if (fs.existsSync(path.join(expectedDir, "project.aether"))) {
    const manifest = readManifest(expectedDir);
    logger.info("Opened existing A.I. Blitz sample project", { expectedDir });
    return {
      projectId: manifest.projectId,
      projectDir: expectedDir,
      manifest,
      characterSheetImported: manifest.characters[0]?.references.length ? true : false,
    };
  }

  const character = buildBlitzCharacter();
  const brand = buildAiBlitzBrand();
  const script = buildMission001Script();

  const created = createProject({
    parentDir,
    title: SAMPLE_TITLE,
    applicationVersion,
    description:
      "Sample production: introduces the A.I. Blitz platform and Blitz, the training guide, for the recurring Mission series.",
    productionSettings: {
      productName: "A.I. Blitz",
      productionType: "course-lesson",
      series: "A.I. Blitz Missions",
      episode: "Mission 001",
      targetAudience: "New A.I. Blitz users",
      primaryObjective: "Introduce the platform and establish Blitz as the training guide.",
      targetDurationSeconds: 420,
      aspectRatio: "16:9",
      frameRate: 30,
      stage: "script",
    },
  });

  let characterSheetImported = false;
  const sourceImagePath = getBlitzCharacterSheetSourcePath();
  if (fs.existsSync(sourceImagePath)) {
    const charactersDir = path.join(created.projectDir, "characters");
    fs.mkdirSync(charactersDir, { recursive: true });
    const destPath = path.join(charactersDir, "blitz-character-sheet.jpeg");
    fs.copyFileSync(sourceImagePath, destPath);
    character.references.push({
      id: `charref_${Date.now()}`,
      category: "full-body-view",
      filePath: path.join("characters", "blitz-character-sheet.jpeg"),
      approved: false,
      notes: "Imported automatically from bundled sample resources.",
      tags: ["sample", "character-sheet"],
      createdAt: new Date().toISOString(),
    });
    characterSheetImported = true;
    logger.info("Imported Blitz character sheet into sample project", { destPath });
  } else {
    logger.warn("Blitz character sheet not found in bundled resources; skipping auto-import", {
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
