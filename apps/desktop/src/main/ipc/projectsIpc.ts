import fs from "node:fs";
import path from "node:path";
import { ipcMain, dialog, shell, type BrowserWindow } from "electron";
import { ProjectsRepository, ActivityLogRepository, type AetherDatabase } from "@aether/database";
import {
  createProject,
  saveProject,
  readManifest,
  ProjectEngineError,
  listBackupSnapshots,
  restoreBackupSnapshot,
} from "@aether/project-engine";
import { getDefaultProjectsDir, nowIso, type Logger } from "@aether/core";
import type { ProjectManifest, ProductionSettings } from "@aether/shared-types";
import { ensureAiBlitzSampleProject } from "../sampleAiBlitzProject.js";

export interface AppError {
  title: string;
  detail: string;
  code?: string;
}

function toAppError(error: unknown): AppError {
  if (error instanceof ProjectEngineError) {
    return { title: "Project error", detail: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { title: "Unexpected error", detail: error.message };
  }
  return { title: "Unexpected error", detail: String(error) };
}

interface RegisterDeps {
  db: AetherDatabase;
  logger: Logger;
  applicationVersion: string;
  getWindow: () => BrowserWindow | null;
}

export function registerProjectsIpc({ db, logger, applicationVersion, getWindow }: RegisterDeps): void {
  const projects = new ProjectsRepository(db);
  const activity = new ActivityLogRepository(db);

  function registerInDb(projectDir: string, manifest: ProjectManifest): void {
    projects.upsert({
      id: manifest.projectId,
      title: manifest.title,
      manifestPath: path.join(projectDir, "project.aether"),
      projectDir,
      productionType: manifest.productionSettings.productionType,
      stage: manifest.productionSettings.stage,
      createdAt: manifest.createdAt,
      modifiedAt: manifest.modifiedAt,
    });
  }

  ipcMain.handle("projects:list-recent", () => {
    return projects.listRecent(20).map((row) => ({
      ...row,
      isMissing: row.is_missing === 1 || !fs.existsSync(row.manifest_path),
    }));
  });

  ipcMain.handle("projects:choose-parent-folder", async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "Choose a location for this production",
      defaultPath: getDefaultProjectsDir(),
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    "projects:create",
    (
      _event,
      args: { title: string; parentDir?: string; description?: string; productionSettings?: Partial<ProductionSettings> },
    ) => {
      try {
        const parentDir = args.parentDir ?? getDefaultProjectsDir();
        fs.mkdirSync(parentDir, { recursive: true });
        const created = createProject({
          parentDir,
          title: args.title,
          applicationVersion,
          description: args.description,
          productionSettings: args.productionSettings,
        });
        registerInDb(created.projectDir, created.manifest);
        activity.record({
          projectId: created.projectId,
          eventType: "project-created",
          message: `Created production "${created.manifest.title}"`,
        });
        return { ok: true as const, manifest: created.manifest, projectDir: created.projectDir };
      } catch (error) {
        logger.error("projects:create failed", error);
        return { ok: false as const, error: toAppError(error) };
      }
    },
  );

  ipcMain.handle("projects:open", (_event, projectDir: string) => {
    try {
      const manifest = readManifest(projectDir);
      registerInDb(projectDir, manifest);
      projects.markOpened(manifest.projectId, nowIso());
      activity.record({
        projectId: manifest.projectId,
        eventType: "project-opened",
        message: `Opened production "${manifest.title}"`,
      });
      return { ok: true as const, manifest, projectDir };
    } catch (error) {
      logger.error("projects:open failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("projects:choose-and-open", async () => {
    const win = getWindow();
    if (!win) return { ok: false as const, error: { title: "No window", detail: "Application window unavailable." } };
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "Open a production (select its project folder)",
      defaultPath: getDefaultProjectsDir(),
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false as const, canceled: true as const };
    }
    const projectDir = result.filePaths[0]!;
    try {
      const manifest = readManifest(projectDir);
      registerInDb(projectDir, manifest);
      projects.markOpened(manifest.projectId, nowIso());
      return { ok: true as const, manifest, projectDir };
    } catch (error) {
      logger.error("projects:choose-and-open failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("projects:save", (_event, projectDir: string, manifest: ProjectManifest) => {
    try {
      const saved = saveProject(projectDir, manifest);
      registerInDb(projectDir, saved);
      activity.record({
        projectId: saved.projectId,
        eventType: "project-saved",
        message: `Saved production "${saved.title}"`,
      });
      return { ok: true as const, manifest: saved };
    } catch (error) {
      logger.error("projects:save failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("projects:open-sample-ai-blitz", () => {
    try {
      const parentDir = getDefaultProjectsDir();
      fs.mkdirSync(parentDir, { recursive: true });
      const result = ensureAiBlitzSampleProject(parentDir, applicationVersion, logger);
      registerInDb(result.projectDir, result.manifest);
      projects.markOpened(result.projectId, nowIso());
      activity.record({
        projectId: result.projectId,
        eventType: "sample-project-opened",
        message: "Opened the A.I. Blitz sample project",
      });
      return { ok: true as const, ...result };
    } catch (error) {
      logger.error("projects:open-sample-ai-blitz failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("projects:list-backups", (_event, projectDir: string) => {
    try {
      return { ok: true as const, backups: listBackupSnapshots(projectDir) };
    } catch (error) {
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("projects:restore-backup", (_event, projectDir: string, backupFileName: string) => {
    try {
      restoreBackupSnapshot(projectDir, backupFileName);
      const manifest = readManifest(projectDir);
      registerInDb(projectDir, manifest);
      activity.record({
        projectId: manifest.projectId,
        eventType: "project-restored",
        message: `Restored backup ${backupFileName}`,
      });
      return { ok: true as const, manifest };
    } catch (error) {
      logger.error("projects:restore-backup failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("projects:import-character-reference", async (_event, projectDir: string, characterId: string) => {
    const win = getWindow();
    if (!win) return { ok: false as const, error: { title: "No window", detail: "Application window unavailable." } };
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      title: "Locate the character reference image",
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false as const, canceled: true as const };
    }
    try {
      const manifest = readManifest(projectDir);
      const character = manifest.characters.find((c) => c.id === characterId);
      if (!character) {
        return { ok: false as const, error: { title: "Character not found", detail: characterId } };
      }
      const sourcePath = result.filePaths[0]!;
      const charactersDir = path.join(projectDir, "characters");
      fs.mkdirSync(charactersDir, { recursive: true });
      const destName = `${character.name.replace(/[^a-z0-9-]+/gi, "-")}-${Date.now()}${path.extname(sourcePath)}`;
      fs.copyFileSync(sourcePath, path.join(charactersDir, destName));
      character.references.push({
        id: `charref_${Date.now()}`,
        category: "full-body-view",
        filePath: path.join("characters", destName),
        approved: false,
        tags: [],
        createdAt: nowIso(),
      });
      const saved = saveProject(projectDir, manifest);
      return { ok: true as const, manifest: saved };
    } catch (error) {
      logger.error("projects:import-character-reference failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("shell:open-path", async (_event, targetPath: string) => {
    const error = await shell.openPath(targetPath);
    return { ok: error.length === 0, error: error || undefined };
  });
}
