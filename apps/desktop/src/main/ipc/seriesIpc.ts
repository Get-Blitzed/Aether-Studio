import { ipcMain } from "electron";
import { SeriesRepository, type AetherDatabase } from "@aether/database";
import type { SeriesPlan } from "@aether/shared-types";
import type { Logger } from "@aether/core";
import type { AppError } from "./projectsIpc.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Series plan error", detail: error.message };
  return { title: "Series plan error", detail: String(error) };
}

export function registerSeriesIpc(db: AetherDatabase, logger: Logger): void {
  const repo = new SeriesRepository(db);

  ipcMain.handle("series:list", () => repo.list());

  ipcMain.handle("series:save", (_event, plan: SeriesPlan) => {
    try {
      return { ok: true as const, plan: repo.save(plan) };
    } catch (error) {
      logger.error("series:save failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("series:remove", (_event, id: string) => {
    try {
      repo.remove(id);
      return { ok: true as const };
    } catch (error) {
      logger.error("series:remove failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });
}
