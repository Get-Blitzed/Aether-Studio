import type { AetherDatabase } from "../db.js";

export interface ProjectRegistryRow {
  id: string;
  title: string;
  manifest_path: string;
  project_dir: string;
  production_type: string | null;
  stage: string | null;
  thumbnail_path: string | null;
  created_at: string;
  modified_at: string;
  last_opened_at: string | null;
  is_missing: number;
}

export class ProjectsRepository {
  constructor(private readonly db: AetherDatabase) {}

  upsert(entry: {
    id: string;
    title: string;
    manifestPath: string;
    projectDir: string;
    productionType?: string;
    stage?: string;
    thumbnailPath?: string;
    createdAt: string;
    modifiedAt: string;
  }): void {
    this.db.raw
      .prepare(
        `INSERT INTO projects (id, title, manifest_path, project_dir, production_type, stage, thumbnail_path, created_at, modified_at, last_opened_at, is_missing)
         VALUES (@id, @title, @manifestPath, @projectDir, @productionType, @stage, @thumbnailPath, @createdAt, @modifiedAt, NULL, 0)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           manifest_path = excluded.manifest_path,
           project_dir = excluded.project_dir,
           production_type = excluded.production_type,
           stage = excluded.stage,
           thumbnail_path = excluded.thumbnail_path,
           modified_at = excluded.modified_at,
           is_missing = 0`,
      )
      .run({
        id: entry.id,
        title: entry.title,
        manifestPath: entry.manifestPath,
        projectDir: entry.projectDir,
        productionType: entry.productionType ?? null,
        stage: entry.stage ?? null,
        thumbnailPath: entry.thumbnailPath ?? null,
        createdAt: entry.createdAt,
        modifiedAt: entry.modifiedAt,
      });
  }

  markOpened(id: string, whenIso: string): void {
    this.db.raw.prepare("UPDATE projects SET last_opened_at = ? WHERE id = ?").run(whenIso, id);
  }

  markMissing(id: string, missing: boolean): void {
    this.db.raw.prepare("UPDATE projects SET is_missing = ? WHERE id = ?").run(missing ? 1 : 0, id);
  }

  listRecent(limit = 20): ProjectRegistryRow[] {
    return this.db.raw
      .prepare(
        `SELECT * FROM projects ORDER BY (last_opened_at IS NULL), last_opened_at DESC, modified_at DESC LIMIT ?`,
      )
      .all(limit) as ProjectRegistryRow[];
  }

  findById(id: string): ProjectRegistryRow | undefined {
    return this.db.raw.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
      | ProjectRegistryRow
      | undefined;
  }

  remove(id: string): void {
    this.db.raw.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }
}
