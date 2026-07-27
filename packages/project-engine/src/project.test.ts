import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createProject } from "./createProject.js";
import { saveProject } from "./saveProject.js";
import { readManifest, manifestPathFor } from "./manifestIO.js";
import { createBackupSnapshot, listBackupSnapshots, restoreBackupSnapshot } from "./backup.js";
import { ProjectEngineError } from "./errors.js";
import { PROJECT_SUBDIRECTORIES } from "./projectStructure.js";

describe("project-engine", () => {
  let parentDir: string;

  beforeEach(() => {
    parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-project-test-"));
  });

  afterEach(() => {
    fs.rmSync(parentDir, { recursive: true, force: true });
  });

  it("creates the full project directory structure and a valid manifest", () => {
    const result = createProject({
      parentDir,
      title: "Sample Production",
      applicationVersion: "0.1.0-test",
    });

    for (const sub of PROJECT_SUBDIRECTORIES) {
      expect(fs.existsSync(path.join(result.projectDir, sub))).toBe(true);
    }
    expect(fs.existsSync(manifestPathFor(result.projectDir))).toBe(true);
    expect(result.manifest.title).toBe("Sample Production");
    expect(result.manifest.formatVersion).toBe(1);
  });

  it("sanitizes the title into a safe folder name", () => {
    const result = createProject({
      parentDir,
      title: 'A.I. Blitz: Mission "001"?',
      applicationVersion: "0.1.0-test",
    });
    expect(fs.existsSync(result.projectDir)).toBe(true);
    expect(path.basename(result.projectDir)).not.toMatch(/[<>:"?]/);
  });

  it("refuses to create a project inside an existing non-empty folder", () => {
    const first = createProject({ parentDir, title: "Dup", applicationVersion: "0.1.0-test" });
    expect(fs.readdirSync(first.projectDir).length).toBeGreaterThan(0);
    expect(() => createProject({ parentDir, title: "Dup", applicationVersion: "0.1.0-test" })).toThrow(
      ProjectEngineError,
    );
  });

  it("round-trips a save and reload", () => {
    const created = createProject({ parentDir, title: "Roundtrip", applicationVersion: "0.1.0-test" });
    const updated = saveProject(created.projectDir, {
      ...created.manifest,
      description: "Updated description",
    });
    expect(updated.description).toBe("Updated description");

    const reloaded = readManifest(created.projectDir);
    expect(reloaded.description).toBe("Updated description");
    expect(reloaded.projectId).toBe(created.projectId);
  });

  it("throws a structured error for a missing manifest", () => {
    const emptyDir = fs.mkdtempSync(path.join(parentDir, "empty-"));
    expect(() => readManifest(emptyDir)).toThrow(ProjectEngineError);
  });

  it("throws a structured error for a corrupted manifest", () => {
    const created = createProject({ parentDir, title: "Corrupt Me", applicationVersion: "0.1.0-test" });
    fs.writeFileSync(manifestPathFor(created.projectDir), "{ not valid json", "utf-8");
    expect(() => readManifest(created.projectDir)).toThrow(ProjectEngineError);
  });

  describe("backups", () => {
    it("creates rotating backup snapshots and restores from one", () => {
      const created = createProject({ parentDir, title: "Backed Up", applicationVersion: "0.1.0-test" });
      saveProject(created.projectDir, { ...created.manifest, description: "v2" });
      saveProject(created.projectDir, { ...created.manifest, description: "v3" });

      const backups = listBackupSnapshots(created.projectDir);
      expect(backups.length).toBeGreaterThanOrEqual(2);

      // Corrupt current manifest, then restore the oldest backup (the
      // original, pre-"v2" state) and confirm it comes back intact.
      const oldestBackup = backups[backups.length - 1]!;
      restoreBackupSnapshot(created.projectDir, oldestBackup);
      const restored = readManifest(created.projectDir);
      expect(restored.projectId).toBe(created.projectId);
    });

    it("keeps only the configured number of rotating snapshots", () => {
      const created = createProject({ parentDir, title: "Rotate Me", applicationVersion: "0.1.0-test" });
      for (let i = 0; i < 5; i++) {
        createBackupSnapshot(created.projectDir, 3);
      }
      expect(listBackupSnapshots(created.projectDir).length).toBeLessThanOrEqual(3);
    });
  });
});
