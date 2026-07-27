import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDatabase, type AetherDatabase } from "./db.js";
import { SettingsRepository } from "./repositories/settingsRepository.js";
import { ProjectsRepository } from "./repositories/projectsRepository.js";
import { ActivityLogRepository } from "./repositories/activityLogRepository.js";

describe("database", () => {
  let dbPath: string;
  let database: AetherDatabase;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `aether-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = await openDatabase(dbPath);
  });

  afterEach(() => {
    database.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it("runs migrations and creates the expected tables", () => {
    const tables = database.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all<{ name: string }>()
      .map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "projects",
        "app_settings",
        "activity_log",
        "background_jobs",
        "character_library",
        "brand_library",
        "provider_configurations",
        "series_plans",
        "schema_migrations",
      ]),
    );
  });

  it("persists the database to disk and reloads it", async () => {
    const settingsRepo = new SettingsRepository(database);
    settingsRepo.save({ ...settingsRepo.get(), appearance: "light" });
    database.close(); // idempotent: afterEach's database.close() below is a safe no-op

    const reopened = await openDatabase(dbPath);
    const reloadedSettings = new SettingsRepository(reopened).get();
    expect(reloadedSettings.appearance).toBe("light");
    reopened.close();
  });

  it("does not re-apply an already-applied migration", async () => {
    const versionsBeforeReopen = database.raw
      .prepare("SELECT version FROM schema_migrations")
      .all<{ version: number }>();
    database.close(); // idempotent: afterEach's database.close() below is a safe no-op

    const reopened = await openDatabase(dbPath);
    const versionsAfterReopen = reopened.raw
      .prepare("SELECT version FROM schema_migrations")
      .all<{ version: number }>();
    expect(versionsAfterReopen).toHaveLength(versionsBeforeReopen.length);
    reopened.close();
  });

  describe("SettingsRepository", () => {
    it("returns defaults when nothing has been saved", () => {
      const repo = new SettingsRepository(database);
      expect(repo.get().onboardingCompleted).toBe(false);
    });

    it("round-trips saved settings", () => {
      const repo = new SettingsRepository(database);
      const saved = repo.save({ ...repo.get(), onboardingCompleted: true, autosaveIntervalSeconds: 30 });
      expect(saved.onboardingCompleted).toBe(true);
      expect(repo.get().autosaveIntervalSeconds).toBe(30);
    });
  });

  describe("ProjectsRepository", () => {
    it("upserts and lists recent projects", () => {
      const repo = new ProjectsRepository(database);
      const now = new Date().toISOString();
      repo.upsert({
        id: "proj_1",
        title: "Test Production",
        manifestPath: "C:\\fake\\project.aether",
        projectDir: "C:\\fake",
        createdAt: now,
        modifiedAt: now,
      });
      const recent = repo.listRecent();
      expect(recent).toHaveLength(1);
      expect(recent[0]?.title).toBe("Test Production");
    });

    it("updates an existing row instead of duplicating on re-upsert", () => {
      const repo = new ProjectsRepository(database);
      const now = new Date().toISOString();
      const base = {
        id: "proj_1",
        title: "Test Production",
        manifestPath: "C:\\fake\\project.aether",
        projectDir: "C:\\fake",
        createdAt: now,
        modifiedAt: now,
      };
      repo.upsert(base);
      repo.upsert({ ...base, title: "Renamed Production", modifiedAt: new Date().toISOString() });
      const recent = repo.listRecent();
      expect(recent).toHaveLength(1);
      expect(recent[0]?.title).toBe("Renamed Production");
    });
  });

  describe("ActivityLogRepository", () => {
    it("records and lists activity for a project", () => {
      const projects = new ProjectsRepository(database);
      const activity = new ActivityLogRepository(database);
      const now = new Date().toISOString();
      projects.upsert({
        id: "proj_1",
        title: "Test Production",
        manifestPath: "C:\\fake\\project.aether",
        projectDir: "C:\\fake",
        createdAt: now,
        modifiedAt: now,
      });
      activity.record({ projectId: "proj_1", eventType: "project-created", message: "Created" });
      const entries = activity.listForProject("proj_1") as Array<{ message: string }>;
      expect(entries).toHaveLength(1);
      expect(entries[0]?.message).toBe("Created");
    });
  });
});
