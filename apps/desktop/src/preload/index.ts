import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, Asset, AssetCategory, ProductionSettings, ProjectManifest, SeriesPlan } from "@aether/shared-types";

type AudioExportFormat = "wav" | "mp3";

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

  assets: {
    chooseFiles: () => ipcRenderer.invoke("assets:choose-files") as Promise<string[] | null>,
    import: (args: { projectDir: string; filePaths: string[]; category: AssetCategory; storageMode: "managed" | "linked" }) =>
      ipcRenderer.invoke("assets:import", args) as Promise<
        | { ok: true; manifest: ProjectManifest; added: number; duplicates: Array<{ fileName: string; existingAssetId: string }> }
        | { ok: false; error?: AppErrorPayload }
      >,
    checkMissing: (projectDir: string) =>
      ipcRenderer.invoke("assets:check-missing", projectDir) as Promise<
        { ok: true; missingIds: string[] } | { ok: false; error?: AppErrorPayload }
      >,
    relink: (projectDir: string, assetId: string) =>
      ipcRenderer.invoke("assets:relink", projectDir, assetId) as Promise<ProjectResult & { canceled?: boolean }>,
    remove: (projectDir: string, assetId: string) =>
      ipcRenderer.invoke("assets:remove", projectDir, assetId) as Promise<ProjectResult>,
    updateMetadata: (projectDir: string, assetId: string, patch: Partial<Asset>) =>
      ipcRenderer.invoke("assets:update-metadata", projectDir, assetId, patch) as Promise<ProjectResult>,
    reveal: (projectDir: string, assetId: string) =>
      ipcRenderer.invoke("assets:reveal", projectDir, assetId) as Promise<{ ok: boolean; error?: AppErrorPayload }>,
  },

  voice: {
    chooseAudioFiles: () => ipcRenderer.invoke("voice:choose-audio-files") as Promise<string[] | null>,
    importTakes: (args: { projectDir: string; filePaths: string[]; voiceProfileId?: string; scriptSegmentId?: string }) =>
      ipcRenderer.invoke("voice:import-takes", args) as Promise<
        (ProjectResult & { added?: number })
      >,
    processTake: (args: {
      projectDir: string;
      takeId: string;
      action: "trim" | "normalize" | "denoise" | "remove-silence";
      trimStartSeconds?: number;
      trimEndSeconds?: number;
    }) => ipcRenderer.invoke("voice:process-take", args) as Promise<ProjectResult>,
    mergeTakes: (args: { projectDir: string; takeIds: string[]; voiceProfileId?: string }) =>
      ipcRenderer.invoke("voice:merge-takes", args) as Promise<ProjectResult>,
    exportTake: (args: { projectDir: string; takeId: string; format: AudioExportFormat }) =>
      ipcRenderer.invoke("voice:export-take", args) as Promise<
        { ok: true; exportedPath: string } | { ok: false; error?: AppErrorPayload; canceled?: boolean }
      >,
    removeTake: (projectDir: string, takeId: string) =>
      ipcRenderer.invoke("voice:remove-take", projectDir, takeId) as Promise<ProjectResult>,
  },

  screenCapture: {
    listSources: () =>
      ipcRenderer.invoke("screencapture:list-sources") as Promise<
        Array<{ id: string; name: string; thumbnailDataUrl: string; kind: "screen" | "window" }>
      >,
    saveRecording: (args: {
      projectDir: string;
      data: ArrayBuffer;
      fileExtension: string;
      sourceKind: "screen" | "window";
      micEnabled: boolean;
      systemAudioEnabled: boolean;
      privacyChecklistAcknowledged: boolean;
      scriptSegmentId?: string;
      notes?: string;
    }) =>
      ipcRenderer.invoke("screencapture:save-recording", args) as Promise<
        | { ok: true; manifest: ProjectManifest; assetId: string }
        | { ok: false; error?: AppErrorPayload }
      >,
    processClip: (
      args:
        | { projectDir: string; assetId: string; action: "trim"; trimStartSeconds: number; trimEndSeconds: number }
        | { projectDir: string; assetId: string; action: "speed"; speedFactor: number },
    ) => ipcRenderer.invoke("screencapture:process-clip", args) as Promise<ProjectResult>,
  },

  ffmpeg: {
    status: () =>
      ipcRenderer.invoke("ffmpeg:status") as Promise<{
        ffmpegFound: boolean;
        ffmpegPath: string | null;
        ffprobeFound: boolean;
        ffprobePath: string | null;
        version: string | null;
      }>,
  },

  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke("shell:open-path", targetPath) as Promise<{ ok: boolean; error?: string }>,
  },
};

export type AetherBridge = typeof api;

contextBridge.exposeInMainWorld("aether", api);
