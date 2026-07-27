import type { AetherDatabase } from "../db.js";
import { generateId, nowIso } from "@aether/core";

export class ActivityLogRepository {
  constructor(private readonly db: AetherDatabase) {}

  record(event: { projectId?: string; eventType: string; message: string; meta?: unknown }): void {
    this.db.raw
      .prepare(
        `INSERT INTO activity_log (id, project_id, event_type, message, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        generateId("act"),
        event.projectId ?? null,
        event.eventType,
        event.message,
        event.meta !== undefined ? JSON.stringify(event.meta) : null,
        nowIso(),
      );
  }

  listForProject(projectId: string, limit = 50) {
    return this.db.raw
      .prepare(
        "SELECT * FROM activity_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(projectId, limit);
  }
}
