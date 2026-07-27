import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, ProductionSettings, ProjectManifest, SeriesPlan } from "@aether/shared-types";

export interface AppErrorPayload {
  title: string;
  detail: string;
  code?: string;
}

type ProjectResult =
  | { ok: true; manifest: ProjectManifest; projectDir: string }
  | { ok: false; error?: AppErrorPayload; canceled?: boolean };

const api = {
  getStartupInfo: () =>
    ipcRenderer.invoke("app:get-startup-info") as Promise<{
      version: string;
      isPackaged: boolean;
      statusLog: Array<{ message: string; atIso: string }>;
      recoveryDetected: boolean;
      logFilePath: string;
    }>,

  settings: {
    get: () => ipcRenderer.invoke("settings:get") as Promise<AppSettings>,
    save: (settings: AppSettings) => ipcRenderer.invoke("settings:save", settings) as Promise<AppSettings>,
  },

  projects: {
    listRecent: () => ipcRenderer.invoke("projects:list-recent"),
    chooseParentFolder: () => ipcRenderer.invoke("projects:choose-parent-folder") as Promise<string | null>,
    create: (args: { title: string; parentDir?: string; description?: string; productionSettings?: Partial<ProductionSettings> }) =>
      ipcRenderer.invoke("projects:create", args) as Promise<ProjectResult>,
    open: (projectDir: string) => ipcRenderer.invoke("projects:open", projectDir) as Promise<ProjectResult>,
    chooseAndOpen: () => ipcRenderer.invoke("projects:choose-and-open") as Promise<ProjectResult & { canceled?: boolean }>,
    save: (projectDir: string, manifest: ProjectManifest) =>
      ipcRenderer.invoke("projects:save", projectDir, manifest) as Promise<ProjectResult>,
    openSample: () => ipcRenderer.invoke("projects:open-sample-ai-blitz") as Promise<
      ProjectResult & { characterSheetImported?: boolean }
    >,
    listBackups: (projectDir: string) => ipcRenderer.invoke("projects:list-backups", projectDir),
    restoreBackup: (projectDir: string, backupFileName: string) =>
      ipcRenderer.invoke("projects:restore-backup", projectDir, backupFileName) as Promise<ProjectResult>,
    importCharacterReference: (projectDir: string, characterId: string) =>
      ipcRenderer.invoke("projects:import-character-reference", projectDir, characterId) as Promise<
        ProjectResult & { canceled?: boolean }
      >,
  },

  series: {
    list: () => ipcRenderer.invoke("series:list") as Promise<SeriesPlan[]>,
    save: (plan: SeriesPlan) =>
      ipcRenderer.invoke("series:save", plan) as Promise<
        { ok: true; plan: SeriesPlan } | { ok: false; error?: AppErrorPayload }
      >,
    remove: (id: string) =>
      ipcRenderer.invoke("series:remove", id) as Promise<{ ok: true } | { ok: false; error?: AppErrorPayload }>,
  },

  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath) as Promise<{ ok: boolean; error?: string }>,
  },
};

export type AetherBridge = typeof api;

contextBridge.exposeInMainWorld("aether", api);
