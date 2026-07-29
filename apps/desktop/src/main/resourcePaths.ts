import path from "node:path";
import { app } from "electron";

/** Read-only resources shipped with the app (branding, sample projects, templates). */
export function getBundledResourcesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "resources");
  }
  // In dev, electron-vite runs with cwd = apps/desktop, two levels below repo root.
  return path.resolve(app.getAppPath(), "..", "..", "resources");
}

export function getNovaCharacterSheetSourcePath(): string {
  return path.join(
    getBundledResourcesDir(),
    "sample-projects",
    "orbit",
    "characters",
    "nova",
    "nova-character-sheet.svg",
  );
}

export function getSoundLibraryDir(): string {
  return path.join(getBundledResourcesDir(), "sound-library");
}

export function getPiperDir(): string {
  return path.join(getBundledResourcesDir(), "piper");
}

export function getMusicLibraryDir(): string {
  return path.join(getBundledResourcesDir(), "music-library");
}
