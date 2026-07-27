import type { AssetCategory } from "@aether/shared-types";

export type AssetPreviewKind = "image" | "video" | "audio" | "other";

const EXTENSION_KIND: Record<string, AssetPreviewKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".bmp": "image",
  ".svg": "image",
  ".mp4": "video",
  ".mov": "video",
  ".webm": "video",
  ".mkv": "video",
  ".avi": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".flac": "audio",
  ".ogg": "audio",
};

/**
 * Preview kind is derived from the file's own extension, not the asset's
 * `category` -- category is a user-chosen organizational label (e.g. "logo"
 * vs. "graphic") independent of the file's actual type, and a user can
 * (correctly) file any file type under any category. Deriving preview kind
 * from category instead of the real file type breaks the preview the
 * moment someone imports, say, a video under the wrong category -- this
 * was caught during Phase 3 manual verification.
 */
export function previewKindForFileName(fileName: string): AssetPreviewKind {
  const match = /\.[^.]+$/.exec(fileName.toLowerCase());
  const ext = match ? match[0] : "";
  return EXTENSION_KIND[ext] ?? "other";
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  "images",
  "videos",
  "animation-clips",
  "screen-recordings",
  "narration",
  "music",
  "sound-effects",
  "logos",
  "graphics",
  "fonts",
  "scripts",
  "storyboards",
  "captions",
  "transcripts",
  "overlays",
  "transitions",
  "thumbnails",
  "exports",
  "source-documents",
];

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}
