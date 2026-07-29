import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  Asset,
  AssetCategory,
  BackgroundJob,
  ProductionSettings,
  ProjectManifest,
  ProviderConfig,
  QualityCheck,
  SeriesPlan,
  VoiceTake,
} from "@aether/shared-types";

interface VoiceOptionPayload {
  id: string;
  name: string;
  gender?: string;
  locale?: string;
}

interface SoundLibraryEntryPayload {
  id: string;
  filePath: string;
  title: string;
  category: string;
  categoryLabel: string;
  durationSeconds: number | null;
  originalFileName: string;
}

interface MusicLibraryEntryPayload {
  id: string;
  title: string;
  filePath: string;
  mood: string;
  moodLabel: string;
  durationSeconds: number | null;
  attribution: string;
}

interface IconLibraryEntryPayload {
  id: string;
  title: string;
  filePath: string;
  tags: string[];
}

interface ExportPresetPayload {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
}

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

  getIntroAudio: () =>
    ipcRenderer.invoke("app:get-intro-audio") as Promise<{ ok: true; filePath: string } | { ok: false }>,

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
    openSample: () => ipcRenderer.invoke("projects:open-sample") as Promise<
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

  timeline: {
    renderPreview: (args: { projectDir: string; timelineId: string }) =>
      ipcRenderer.invoke("timeline:render-preview", args) as Promise<
        { ok: true; manifest: ProjectManifest; assetId: string } | { ok: false; error?: AppErrorPayload }
      >,
  },

  captions: {
    export: (args: { projectDir: string; format: "srt" | "vtt" }) =>
      ipcRenderer.invoke("captions:export", args) as Promise<
        { ok: true; exportedPath: string } | { ok: false; error?: AppErrorPayload; canceled?: boolean }
      >,
    import: (projectDir: string) =>
      ipcRenderer.invoke("captions:import", projectDir) as Promise<
        (ProjectResult & { canceled?: boolean; imported?: number })
      >,
  },

  providers: {
    list: () => ipcRenderer.invoke("providers:list") as Promise<ProviderConfig[]>,
    listJobs: () => ipcRenderer.invoke("providers:list-jobs") as Promise<BackgroundJob[]>,
    save: (args: { config: Omit<ProviderConfig, "hasSecret">; secret?: string }) =>
      ipcRenderer.invoke("providers:save", args) as Promise<
        { ok: true; config: ProviderConfig } | { ok: false; error?: AppErrorPayload }
      >,
    remove: (id: string) => ipcRenderer.invoke("providers:remove", id) as Promise<{ ok: boolean; error?: AppErrorPayload }>,
    test: (id: string) =>
      ipcRenderer.invoke("providers:test", id) as Promise<
        { ok: true; result: { ok: boolean; message: string } } | { ok: false; error?: AppErrorPayload }
      >,
    listVoices: (providerId: string) =>
      ipcRenderer.invoke("providers:list-voices", providerId) as Promise<
        { ok: true; voices: VoiceOptionPayload[] } | { ok: false; error?: AppErrorPayload }
      >,
    runJob: (args: {
      jobType: string;
      providerId: string;
      input: Record<string, string | number | undefined>;
      projectDir?: string;
      imageWidth?: number;
      imageHeight?: number;
      voiceId?: string;
      voiceRate?: number;
      voicePitchSemitones?: number;
      voiceVolume?: number;
      voiceProfileId?: string;
      scriptSegmentId?: string;
    }) =>
      ipcRenderer.invoke("providers:run-job", args) as Promise<
        | {
            ok: true;
            job: BackgroundJob;
            text?: string;
            asset?: Asset;
            imagePath?: string;
            audioPath?: string;
            voiceTake?: VoiceTake;
            manifest?: ProjectManifest;
          }
        | { ok: false; error?: AppErrorPayload; job?: BackgroundJob }
      >,
  },

  export: {
    listPresets: () => ipcRenderer.invoke("export:list-presets") as Promise<ExportPresetPayload[]>,
    runQualityChecklist: (projectDir: string) =>
      ipcRenderer.invoke("export:run-quality-checklist", projectDir) as Promise<
        { ok: true; checks: QualityCheck[] } | { ok: false; error?: AppErrorPayload }
      >,
    render: (args: { projectDir: string; timelineId: string; presetId: string }) =>
      ipcRenderer.invoke("export:render", args) as Promise<
        { ok: true; manifest: ProjectManifest; assetId: string } | { ok: false; error?: AppErrorPayload }
      >,
    createArchive: (projectDir: string) =>
      ipcRenderer.invoke("export:create-archive", projectDir) as Promise<
        { ok: true; archivePath: string } | { ok: false; error?: AppErrorPayload }
      >,
  },

  documents: {
    chooseFile: () => ipcRenderer.invoke("documents:choose-file") as Promise<string | null>,
    importAndConvert: (args: { projectDir: string; filePath: string; narrate?: boolean }) =>
      ipcRenderer.invoke("documents:import-and-convert", args) as Promise<
        | { ok: true; mode: "asset-import"; manifest: ProjectManifest }
        | {
            ok: true;
            mode: "document-conversion";
            manifest: ProjectManifest;
            scriptId: string;
            timelineId: string;
            pageCount: number;
            narratedPageCount: number;
          }
        | { ok: false; error?: AppErrorPayload }
      >,
  },

  soundLibrary: {
    list: () =>
      ipcRenderer.invoke("sound-library:list") as Promise<
        { ok: true; entries: (SoundLibraryEntryPayload & { absolutePath: string })[] } | { ok: false; error?: AppErrorPayload }
      >,
    import: (args: { projectDir: string; entryIds: string[] }) =>
      ipcRenderer.invoke("sound-library:import", args) as Promise<
        { ok: true; manifest: ProjectManifest; added: number; duplicates: string[] } | { ok: false; error?: AppErrorPayload }
      >,
  },

  musicLibrary: {
    list: () =>
      ipcRenderer.invoke("music-library:list") as Promise<
        { ok: true; entries: (MusicLibraryEntryPayload & { absolutePath: string })[] } | { ok: false; error?: AppErrorPayload }
      >,
    import: (args: { projectDir: string; entryIds: string[] }) =>
      ipcRenderer.invoke("music-library:import", args) as Promise<
        { ok: true; manifest: ProjectManifest; added: number; duplicates: string[] } | { ok: false; error?: AppErrorPayload }
      >,
  },

  iconLibrary: {
    list: () =>
      ipcRenderer.invoke("icon-library:list") as Promise<
        { ok: true; entries: (IconLibraryEntryPayload & { absolutePath: string })[] } | { ok: false; error?: AppErrorPayload }
      >,
    import: (args: { projectDir: string; entryIds: string[] }) =>
      ipcRenderer.invoke("icon-library:import", args) as Promise<
        { ok: true; manifest: ProjectManifest; added: number; duplicates: string[] } | { ok: false; error?: AppErrorPayload }
      >,
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
