import type { AetherDatabase } from "../db.js";
import { AppSettingsSchema, DEFAULT_APP_SETTINGS, type AppSettings } from "@aether/shared-types";

const SETTINGS_KEY = "app-settings";

export class SettingsRepository {
  constructor(private readonly db: AetherDatabase) {}

  get(): AppSettings {
    const row = this.db.raw
      .prepare("SELECT value FROM app_settings WHERE key = ?")
      .get(SETTINGS_KEY) as { value: string } | undefined;
    if (!row) return DEFAULT_APP_SETTINGS;
    try {
      return AppSettingsSchema.parse(JSON.parse(row.value));
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  }

  save(settings: AppSettings): AppSettings {
    const validated = AppSettingsSchema.parse(settings);
    this.db.raw
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(SETTINGS_KEY, JSON.stringify(validated), new Date().toISOString());
    return validated;
  }
}
