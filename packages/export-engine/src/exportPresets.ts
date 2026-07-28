export interface ExportPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
}

/**
 * Built-in delivery presets. Not user-editable in this phase (see
 * ROADMAP.md) -- a fixed, well-understood list covers the spec's "export
 * presets" and "social-media version generator" requirements without a
 * CRUD screen of its own.
 */
export const EXPORT_PRESETS: ExportPreset[] = [
  { id: "youtube-1080p", name: "YouTube / Standard 1080p", width: 1920, height: 1080, frameRate: 30 },
  { id: "youtube-720p", name: "YouTube / Standard 720p", width: 1280, height: 720, frameRate: 30 },
  { id: "vertical-1080x1920", name: "Vertical / Shorts & Reels (9:16)", width: 1080, height: 1920, frameRate: 30 },
  { id: "square-1080x1080", name: "Square / Social (1:1)", width: 1080, height: 1080, frameRate: 30 },
];

export function getExportPreset(id: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find((p) => p.id === id);
}
