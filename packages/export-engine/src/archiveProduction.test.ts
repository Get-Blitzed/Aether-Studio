import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { archiveProduction } from "./archiveProduction.js";
import { ExportEngineError } from "./errors.js";

describe("archiveProduction", () => {
  let projectDir: string;
  let outputDir: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-test-project-"));
    fs.writeFileSync(path.join(projectDir, "project.aether"), JSON.stringify({ title: "Test" }));
    fs.mkdirSync(path.join(projectDir, "assets", "images"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "assets", "images", "logo.png"), "fake-image-bytes");
    fs.mkdirSync(path.join(projectDir, "cache", "previews"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "cache", "previews", "logo-thumb.jpg"), "regenerable-thumbnail");
    fs.mkdirSync(path.join(projectDir, "archives"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "archives", "old-archive.zip"), "a-previous-archive-that-should-not-nest");

    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-test-output-"));
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("creates a real zip containing the project's manifest and assets", () => {
    const zipPath = path.join(outputDir, "production-archive.zip");
    archiveProduction(projectDir, zipPath);

    expect(fs.existsSync(zipPath)).toBe(true);
    const zip = new AdmZip(zipPath);
    const entryNames = zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
    expect(entryNames).toContain("project.aether");
    expect(entryNames).toContain("assets/images/logo.png");
    expect(zip.readAsText("assets/images/logo.png")).toBe("fake-image-bytes");
  });

  it("excludes the regenerable cache folder and prior archives", () => {
    const zipPath = path.join(outputDir, "production-archive-2.zip");
    archiveProduction(projectDir, zipPath);

    const zip = new AdmZip(zipPath);
    const entryNames = zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
    expect(entryNames.some((n) => n.startsWith("cache/"))).toBe(false);
    expect(entryNames.some((n) => n.startsWith("archives/"))).toBe(false);
  });

  it("throws a structured error for a missing project directory", () => {
    expect(() => archiveProduction(path.join(outputDir, "does-not-exist"), path.join(outputDir, "x.zip"))).toThrow(ExportEngineError);
  });
});
