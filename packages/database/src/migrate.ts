import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AetherRawDatabase } from "./sqlJsAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  const dir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((file) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(file);
    if (!match) {
      throw new Error(`Migration file does not follow NNNN_name.sql convention: ${file}`);
    }
    const versionStr = match[1] ?? "";
    const name = match[2] ?? file;
    return {
      version: Number.parseInt(versionStr, 10),
      name,
      sql: fs.readFileSync(path.join(dir, file), "utf-8"),
    };
  });
}

/**
 * Applies any migrations newer than the database's current schema_migrations
 * table, in order. Each migration is additive SQL (CREATE TABLE IF NOT
 * EXISTS, ALTER TABLE ADD COLUMN, etc.) so re-running a no-op migration is
 * always safe.
 */
export function runMigrations(db: AetherRawDatabase): { applied: number[] } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
    .all<{ version: number }>();
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  const migrations = loadMigrations();
  const applied: number[] = [];

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    db.exec(migration.sql);
    db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
      migration.version,
      migration.name,
      new Date().toISOString(),
    );
    applied.push(migration.version);
  }

  return { applied };
}
