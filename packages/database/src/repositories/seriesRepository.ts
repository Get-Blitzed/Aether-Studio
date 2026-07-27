import type { AetherDatabase } from "../db.js";
import { SeriesPlanSchema, type SeriesPlan } from "@aether/shared-types";

interface SeriesPlanRow {
  id: string;
  title: string;
  data_json: string;
  created_at: string;
  modified_at: string;
}

function rowToPlan(row: SeriesPlanRow): SeriesPlan {
  return SeriesPlanSchema.parse(JSON.parse(row.data_json));
}

export class SeriesRepository {
  constructor(private readonly db: AetherDatabase) {}

  list(): SeriesPlan[] {
    const rows = this.db.raw
      .prepare("SELECT * FROM series_plans ORDER BY modified_at DESC")
      .all<SeriesPlanRow>();
    return rows.map(rowToPlan);
  }

  get(id: string): SeriesPlan | undefined {
    const row = this.db.raw.prepare("SELECT * FROM series_plans WHERE id = ?").get<SeriesPlanRow>(id);
    return row ? rowToPlan(row) : undefined;
  }

  save(plan: SeriesPlan): SeriesPlan {
    const validated = SeriesPlanSchema.parse(plan);
    this.db.raw
      .prepare(
        `INSERT INTO series_plans (id, title, data_json, created_at, modified_at)
         VALUES (@id, @title, @dataJson, @createdAt, @modifiedAt)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           data_json = excluded.data_json,
           modified_at = excluded.modified_at`,
      )
      .run({
        id: validated.id,
        title: validated.title,
        dataJson: JSON.stringify(validated),
        createdAt: validated.createdAt,
        modifiedAt: validated.modifiedAt,
      });
    return validated;
  }

  remove(id: string): void {
    this.db.raw.prepare("DELETE FROM series_plans WHERE id = ?").run(id);
  }
}
