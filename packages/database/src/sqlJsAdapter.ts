import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";

/**
 * A synchronous, better-sqlite3-shaped facade over sql.js (WASM SQLite).
 *
 * We use sql.js instead of better-sqlite3 deliberately: better-sqlite3 is a
 * native addon that must be compiled per Node/Electron ABI, which requires a
 * working MSVC + node-gyp toolchain. That toolchain is not guaranteed to be
 * present on every development or end-user machine, and its absence turns
 * `npm install` into a hard failure (see KNOWN_LIMITATIONS.md). sql.js has no
 * native dependency, so the app works everywhere Node/Electron runs. The
 * tradeoff is that sql.js keeps the whole database in memory and this facade
 * writes the full file back to disk after every mutating statement -- fine
 * at this app's metadata scale (thousands of rows, not millions), and worth
 * revisiting if that ever changes.
 */
export interface SqlValue {
  [key: string]: unknown;
}

class Statement {
  constructor(
    private readonly db: SqlJsDatabase,
    private readonly sql: string,
    private readonly onMutate: () => void,
  ) {}

  private bindArgs(params: unknown[]): Record<string, unknown> | unknown[] {
    if (params.length === 1 && params[0] !== null && typeof params[0] === "object" && !Array.isArray(params[0])) {
      const obj = params[0] as Record<string, unknown>;
      const prefixed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        prefixed[key.startsWith("@") || key.startsWith(":") || key.startsWith("$") ? key : `@${key}`] = value;
      }
      return prefixed;
    }
    return params;
  }

  run(...params: unknown[]): void {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(this.bindArgs(params) as never);
      stmt.step();
    } finally {
      stmt.free();
    }
    this.onMutate();
  }

  get<T = SqlValue>(...params: unknown[]): T | undefined {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) stmt.bind(this.bindArgs(params) as never);
      if (stmt.step()) {
        return stmt.getAsObject() as T;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  all<T = SqlValue>(...params: unknown[]): T[] {
    const stmt = this.db.prepare(this.sql);
    const rows: T[] = [];
    try {
      if (params.length > 0) stmt.bind(this.bindArgs(params) as never);
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
    } finally {
      stmt.free();
    }
    return rows;
  }
}

export class AetherRawDatabase {
  private readonly sqlJsDb: SqlJsDatabase;
  private closed = false;

  constructor(
    sqlJsDb: SqlJsDatabase,
    private readonly persist: () => void,
  ) {
    this.sqlJsDb = sqlJsDb;
  }

  exec(sql: string): void {
    this.sqlJsDb.run(sql);
    this.persist();
  }

  pragma(_directive: string): void {
    // sql.js is single-connection and in-memory-until-exported; WAL/foreign-key
    // pragmas are accepted but largely no-ops. Kept as a call for API parity.
  }

  prepare(sql: string): Statement {
    return new Statement(this.sqlJsDb, sql, () => this.persist());
  }

  transaction<T extends (...args: never[]) => unknown>(fn: T): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>): ReturnType<T> => {
      this.sqlJsDb.run("BEGIN");
      try {
        const result = fn(...args) as ReturnType<T>;
        this.sqlJsDb.run("COMMIT");
        this.persist();
        return result;
      } catch (error) {
        this.sqlJsDb.run("ROLLBACK");
        throw error;
      }
    };
  }

  exportToBuffer(): Buffer {
    return Buffer.from(this.sqlJsDb.export());
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.persist();
    this.sqlJsDb.close();
  }
}

export async function loadSqlJsDatabase(dbPath: string): Promise<AetherRawDatabase> {
  // Under Node/Electron (as opposed to a browser bundle), sql.js locates its
  // own .wasm file relative to its own package directory without help, so no
  // locateFile override is needed here -- and avoiding one keeps this module
  // free of CJS-only APIs like require.resolve.
  const SQL = await initSqlJs();

  const existing = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  const sqlJsDb = existing ? new SQL.Database(existing) : new SQL.Database();

  const persist = (): void => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const data = Buffer.from(sqlJsDb.export());
    const tempPath = `${dbPath}.tmp-${process.pid}`;
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, dbPath);
  };

  return new AetherRawDatabase(sqlJsDb, persist);
}
