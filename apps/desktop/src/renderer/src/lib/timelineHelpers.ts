import type { TimelineTrackType } from "@aether/shared-types";
import { previewKindForFileName } from "./assetPreview";

export const TRACK_TYPES: TimelineTrackType[] = [
  "primary-video",
  "secondary-video",
  "screen-capture",
  "character-animation",
  "graphics",
  "titles",
  "overlays",
  "captions",
  "narration",
  "music",
  "sound-effects",
];

const VIDEO_TRACK_TYPES = new Set<TimelineTrackType>([
  "primary-video",
  "secondary-video",
  "screen-capture",
  "character-animation",
]);
const AUDIO_TRACK_TYPES = new Set<TimelineTrackType>(["narration", "music", "sound-effects"]);
const OVERLAY_TRACK_TYPES = new Set<TimelineTrackType>(["graphics", "titles", "overlays", "captions"]);

export type TrackAssetKind = "video" | "audio" | "overlay";

export function trackAssetKind(type: TimelineTrackType): TrackAssetKind {
  if (VIDEO_TRACK_TYPES.has(type)) return "video";
  if (AUDIO_TRACK_TYPES.has(type)) return "audio";
  return "overlay";
}

export function assetMatchesTrack(fileName: string, type: TimelineTrackType): boolean {
  const kind = previewKindForFileName(fileName);
  const trackKind = trackAssetKind(type);
  if (trackKind === "video") return kind === "video";
  if (trackKind === "audio") return kind === "audio";
  return false;
}

export function isOverlayTrack(type: TimelineTrackType): boolean {
  return OVERLAY_TRACK_TYPES.has(type);
}

export function isCaptionsTrack(type: TimelineTrackType): boolean {
  return type === "captions";
}

export function formatTimecode(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  const frames = Math.floor((clamped % 1) * 30);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(frames).padStart(2, "0")}`;
}

export function timelineDurationSeconds(clips: Array<{ timelineStartSeconds: number; timelineDurationSeconds: number }>): number {
  return clips.reduce((max, c) => Math.max(max, c.timelineStartSeconds + c.timelineDurationSeconds), 0);
}
