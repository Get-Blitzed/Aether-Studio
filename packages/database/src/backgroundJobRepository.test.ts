import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { openDatabase, type AetherDatabase } from "./db.js";
import { BackgroundJobRepository } from "./repositories/backgroundJobRepository.js";

describe("BackgroundJobRepository", () => {
  let dbPath: string;
  let database: AetherDatabase;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `aether-jobs-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = await openDatabase(dbPath);
  });

  afterEach(() => {
    database.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  function sampleJob(overrides: Partial<Parameters<BackgroundJobRepository["save"]>[0]> = {}) {
    const timestamp = new Date().toISOString();
    return {
      id: "job_1",
      jobType: "generate-outline",
      status: "queued" as const,
      progress: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides,
    };
  }

  it("saves and lists recent jobs newest-first", () => {
    const repo = new BackgroundJobRepository(database);
    repo.save(sampleJob({ id: "job_1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }));
    repo.save(sampleJob({ id: "job_2", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }));
    const list = repo.listRecent();
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe("job_2");
  });

  it("updates status/usage on re-save instead of duplicating", () => {
    const repo = new BackgroundJobRepository(database);
    repo.save(sampleJob());
    repo.save(
      sampleJob({
        status: "completed",
        progress: 1,
        usage: { promptTokens: 10, completionTokens: 40, estimatedCostUsd: 0.001 },
      }),
    );
    const list = repo.listRecent();
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe("completed");
    expect(list[0]?.usage?.completionTokens).toBe(40);
  });

  it("respects the limit parameter", () => {
    const repo = new BackgroundJobRepository(database);
    for (let i = 0; i < 5; i += 1) {
      repo.save(sampleJob({ id: `job_${i}`, createdAt: `2026-01-0${i + 1}T00:00:00.000Z`, updatedAt: `2026-01-0${i + 1}T00:00:00.000Z` }));
    }
    expect(repo.listRecent(2)).toHaveLength(2);
  });
});
