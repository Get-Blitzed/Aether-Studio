import { z } from "zod";

export const OverlayTemplateKindSchema = z.enum([
  "opening-title",
  "episode-title",
  "scene-title",
  "lower-third",
  "host-tip",
  "important",
  "warning",
  "step-number",
  "keyboard-shortcut",
  "feature-highlight",
  "mission-objective",
  "system-check",
  "mission-complete",
  "next-mission",
  "call-to-action",
  "end-screen",
]);
export type OverlayTemplateKind = z.infer<typeof OverlayTemplateKindSchema>;

export const OverlayPositionSchema = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "center",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
export type OverlayPosition = z.infer<typeof OverlayPositionSchema>;

/** Descriptive only -- mapped to real CSS transitions in the timeline preview, not a full animation engine. */
export const OverlayAnimationSchema = z.enum(["none", "fade", "slide-up", "slide-down"]);
export type OverlayAnimation = z.infer<typeof OverlayAnimationSchema>;

export const OverlayTemplateSchema = z.object({
  id: z.string(),
  kind: OverlayTemplateKindSchema,
  name: z.string().min(1),
  defaultText: z.string().default(""),
  fontColor: z.string().default("#F4EFE6"),
  backgroundColor: z.string().default("#131A2BCC"),
  position: OverlayPositionSchema.default("bottom-center"),
  suggestedDurationSeconds: z.number().default(4),
  entryAnimation: OverlayAnimationSchema.default("fade"),
  exitAnimation: OverlayAnimationSchema.default("fade"),
  notes: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type OverlayTemplate = z.infer<typeof OverlayTemplateSchema>;
