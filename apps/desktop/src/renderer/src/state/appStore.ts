import { create } from "zustand";
import type { AppSettings, ProjectManifest } from "@aether/shared-types";

export interface RecentProjectItem {
  id: string;
  title: string;
  manifest_path: string;
  project_dir: string;
  production_type: string | null;
  stage: string | null;
  modified_at: string;
  last_opened_at: string | null;
  isMissing: boolean;
}

export interface OpenAppError {
  title: string;
  detail: string;
  code?: string;
}

interface AppState {
  settings: AppSettings | null;
  recentProjects: RecentProjectItem[];
  currentProjectDir: string | null;
  currentManifest: ProjectManifest | null;
  lastError: OpenAppError | null;
  isSaving: boolean;

  setSettings: (s: AppSettings) => void;
  setRecentProjects: (items: RecentProjectItem[]) => void;
  setCurrentProject: (projectDir: string | null, manifest: ProjectManifest | null) => void;
  setLastError: (error: OpenAppError | null) => void;
  setSaving: (saving: boolean) => void;

  refreshRecentProjects: () => Promise<void>;
  loadSettings: () => Promise<void>;
  saveCurrentProject: () => Promise<boolean>;
  updateAndSave: (updater: (manifest: ProjectManifest) => ProjectManifest) => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  recentProjects: [],
  currentProjectDir: null,
  currentManifest: null,
  lastError: null,
  isSaving: false,

  setSettings: (settings) => set({ settings }),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setCurrentProject: (currentProjectDir, currentManifest) => set({ currentProjectDir, currentManifest }),
  setLastError: (lastError) => set({ lastError }),
  setSaving: (isSaving) => set({ isSaving }),

  refreshRecentProjects: async () => {
    const rows = await window.aether.projects.listRecent();
    set({ recentProjects: rows });
  },

  loadSettings: async () => {
    const settings = await window.aether.settings.get();
    set({ settings });
  },

  saveCurrentProject: async () => {
    const { currentProjectDir, currentManifest } = get();
    if (!currentProjectDir || !currentManifest) return false;
    set({ isSaving: true });
    const result = await window.aether.projects.save(currentProjectDir, currentManifest);
    set({ isSaving: false });
    if (result.ok) {
      set({ currentManifest: result.manifest });
      await get().refreshRecentProjects();
      return true;
    }
    set({ lastError: result.error ?? { title: "Save failed", detail: "Unknown error" } });
    return false;
  },

  updateAndSave: async (updater) => {
    const { currentManifest } = get();
    if (!currentManifest) return false;
    set({ currentManifest: updater(currentManifest) });
    return get().saveCurrentProject();
  },
}));
