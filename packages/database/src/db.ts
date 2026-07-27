import { getDatabasePath } from "@aether/core";
import { loadSqlJsDatabase, type AetherRawDatabase } from "./sqlJsAdapter.js";
import { runMigrations } from "./migrate.js";

export interface AetherDatabase {
  readonly raw: AetherRawDatabase;
  close(): void;
}

export async function openDatabase(dbPath: string = getDatabasePath()): Promise<AetherDatabase> {
  const raw = await loadSqlJsDatabase(dbPath);
  runMigrations(raw);
  return {
    raw,
    close: () => raw.close(),
  };
}
