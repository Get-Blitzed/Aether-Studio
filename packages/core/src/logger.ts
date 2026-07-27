import fs from "node:fs";
import path from "node:path";
import { getLogsDir } from "./paths.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization)/i;

/**
 * Redacts likely-secret values before anything is written to disk. This is a
 * best-effort guard, not a substitute for never logging secrets in the first
 * place -- callers must still avoid passing raw credential objects in.
 */
function redact(value: unknown): unknown {
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = Array.isArray(value) ? ([] as unknown as Record<string, unknown>) : {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redact(val);
    }
    return out;
  }
  return value;
}

export class Logger {
  private readonly logFilePath: string;
  private readonly retentionDays: number;

  constructor(options?: { logsDir?: string; retentionDays?: number }) {
    const dir = options?.logsDir ?? getLogsDir();
    fs.mkdirSync(dir, { recursive: true });
    const dateStamp = new Date().toISOString().slice(0, 10);
    this.logFilePath = path.join(dir, `aether-${dateStamp}.log`);
    this.retentionDays = options?.retentionDays ?? 30;
    this.pruneOldLogs(dir);
  }

  private pruneOldLogs(dir: string): void {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
      } catch {
        // Ignore files we can't stat/remove; not fatal to logging.
      }
    }
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta !== undefined ? { meta: redact(meta) } : {}),
    };
    const line = `${JSON.stringify(entry)}\n`;
    try {
      fs.appendFileSync(this.logFilePath, line, "utf-8");
    } catch {
      // Swallow disk-write failures for logging itself; app must not crash
      // because logging failed.
    }
    if (level === "error" || level === "warn") {
      // eslint-disable-next-line no-console
      console[level](message, meta ?? "");
    }
  }

  debug(message: string, meta?: unknown): void {
    this.write("debug", message, meta);
  }
  info(message: string, meta?: unknown): void {
    this.write("info", message, meta);
  }
  warn(message: string, meta?: unknown): void {
    this.write("warn", message, meta);
  }
  error(message: string, meta?: unknown): void {
    this.write("error", message, meta);
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}
