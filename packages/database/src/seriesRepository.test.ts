import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDatabase, type AetherDatabase } from "./db.js";
import { SeriesRepository } from "./repositories/seriesRepository.js";
import { SeriesPlanSchema } from "@aether/shared-types";

describe("SeriesRepository", () => {
  let dbPath: string;
  let database: AetherDatabase;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `aether-series-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = await openDatabase(dbPath);
  });

  afterEach(() => {
    database.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  function samplePlan() {
    const timestamp = new Date().toISOString();
    return SeriesPlanSchema.parse({
      id: "series_1",
      title: "A.I. Blitz Missions",
      episodes: [
        { id: "ep_1", order: 1, title: "Mission 001 - Welcome to A.I. Blitz" },
        { id: "ep_2", order: 2, title: "Mission 002 - Creating Your First Workspace" },
      ],
      createdAt: timestamp,
      modifiedAt: timestamp,
    });
  }

  it("saves and lists series plans", () => {
    const repo = new SeriesRepository(database);
    repo.save(samplePlan());
    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.episodes).toHaveLength(2);
  });

  it("updates an existing plan on re-save instead of duplicating", () => {
    const repo = new SeriesRepository(database);
    const plan = samplePlan();
    repo.save(plan);
    repo.save({ ...plan, title: "Renamed Series" });
    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("Renamed Series");
  });

  it("gets a single plan by id", () => {
    const repo = new SeriesRepository(database);
    repo.save(samplePlan());
    expect(repo.get("series_1")?.title).toBe("A.I. Blitz Missions");
    expect(repo.get("missing")).toBeUndefined();
  });

  it("removes a plan", () => {
    const repo = new SeriesRepository(database);
    repo.save(samplePlan());
    repo.remove("series_1");
    expect(repo.list()).toHaveLength(0);
  });
});
