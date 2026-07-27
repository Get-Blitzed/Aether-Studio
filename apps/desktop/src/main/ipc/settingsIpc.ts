import { ipcMain } from "electron";
import { SettingsRepository, type AetherDatabase } from "@aether/database";
import type { AppSettings } from "@aether/shared-types";

export function registerSettingsIpc(db: AetherDatabase): void {
  const repo = new SettingsRepository(db);

  ipcMain.handle("settings:get", (): AppSettings => repo.get());
  ipcMain.handle("settings:save", (_event, settings: AppSettings): AppSettings => repo.save(settings));
}
