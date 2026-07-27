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

export function getBlitzCharacterSheetSourcePath(): string {
  return path.join(
    getBundledResourcesDir(),
    "sample-projects",
    "ai-blitz",
    "characters",
    "blitz",
    "blitz-character-sheet.jpeg",
  );
}
