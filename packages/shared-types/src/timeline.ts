import { z } from "zod";
import { AspectRatioSchema } from "./enums.js";

export const TimelineTrackTypeSchema = z.enum([
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
]);
export type TimelineTrackType = z.infer<typeof TimelineTrackTypeSchema>;

const AUDIO_TRACK_TYPES = new Set<TimelineTrackType>(["narration", "music", "sound-effects"]);
const VIDEO_TRACK_TYPES = new Set<TimelineTrackType>([
  "primary-video",
  "secondary-video",
  "screen-capture",
  "character-animation",
]);
const OVERLAY_TRACK_TYPES = new Set<TimelineTrackType>(["graphics", "titles", "overlays", "captions"]);

export function isAudioTrackType(type: TimelineTrackType): boolean {
  return AUDIO_TRACK_TYPES.has(type);
}
export function isVideoTrackType(type: TimelineTrackType): boolean {
  return VIDEO_TRACK_TYPES.has(type);
}
export function isOverlayTrackType(type: TimelineTrackType): boolean {
  return OVERLAY_TRACK_TYPES.has(type);
}

export const TimelineTrackSchema = z.object({
  id: z.string(),
  type: TimelineTrackTypeSchema,
  name: z.string().min(1),
  order: z.number(),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
  locked: z.boolean().default(false),
});
export type TimelineTrack = z.infer<typeof TimelineTrackSchema>;

export const TimelineClipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  /** Either assetId (media clip) or overlayTemplateId (graphic/title clip) is set, not both. */
  assetId: z.string().optional(),
  overlayTemplateId: z.string().optional(),
  sourceInSeconds: z.number().default(0),
  sourceOutSeconds: z.number().optional(),
  timelineStartSeconds: z.number(),
  timelineDurationSeconds: z.number(),
  volume: z.number().min(0).max(2).default(1),
  opacity: z.number().min(0).max(1).default(1),
  fadeInSeconds: z.number().min(0).default(0),
  fadeOutSeconds: z.number().min(0).default(0),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
  overlayText: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const TimelineMarkerSchema = z.object({
  id: z.string(),
  timeSeconds: z.number(),
  label: z.string().min(1),
  color: z.string().optional(),
});
export type TimelineMarker = z.infer<typeof TimelineMarkerSchema>;

export const TimelineSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  aspectRatio: AspectRatioSchema.default("16:9"),
  frameRate: z.number().default(30),
  tracks: z.array(TimelineTrackSchema).default([]),
  clips: z.array(TimelineClipSchema).default([]),
  markers: z.array(TimelineMarkerSchema).default([]),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type Timeline = z.infer<typeof TimelineSchema>;
