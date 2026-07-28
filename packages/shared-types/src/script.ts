import { z } from "zod";

export const ScriptSegmentSchema = z.object({
  id: z.string(),
  sceneNumber: z.number(),
  sceneTitle: z.string().optional(),
  estimatedDurationSeconds: z.number().optional(),
  narration: z.string().optional(),
  onScreenAction: z.string().optional(),
  characterAction: z.string().optional(),
  cameraDirection: z.string().optional(),
  screenRecordingInstruction: z.string().optional(),
  graphicDirection: z.string().optional(),
  animationDirection: z.string().optional(),
  soundEffects: z.array(z.string()).default([]),
  musicDirection: z.string().optional(),
  overlayText: z.string().optional(),
  captions: z.string().optional(),
  sourceCitationIds: z.array(z.string()).default([]),
  unverifiedClaim: z.boolean().default(false),
  notes: z.string().optional(),
  approvalStatus: z.enum(["draft", "in-review", "approved"]).default("draft"),
  reviewNotes: z.string().optional(),
});
export type ScriptSegment = z.infer<typeof ScriptSegmentSchema>;

export const ScriptSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  targetDurationSeconds: z.number().optional(),
  narrationSpeedWpm: z.number().default(130),
  segments: z.array(ScriptSegmentSchema).default([]),
  revision: z.number().default(1),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type Script = z.infer<typeof ScriptSchema>;
