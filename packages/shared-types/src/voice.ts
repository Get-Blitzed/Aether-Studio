import { z } from "zod";

/**
 * A named voice direction, not a connected TTS voice -- there is no
 * provider integration yet (that's Phase 6). Provider/model are
 * informational text fields, same pattern as Prompt Workshop's `provider`
 * field: useful for planning and for briefing an external tool, not
 * something the app calls.
 */
export const VoiceProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  characterId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  speed: z.number().optional(),
  pitch: z.number().optional(),
  stability: z.number().optional(),
  emotion: z.string().optional(),
  emphasis: z.string().optional(),
  pronunciationNotes: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

export const VoiceTakeStatusSchema = z.enum(["draft", "approved", "rejected"]);
export type VoiceTakeStatus = z.infer<typeof VoiceTakeStatusSchema>;

export const VoiceTakeSchema = z.object({
  id: z.string(),
  voiceProfileId: z.string().optional(),
  scriptSegmentId: z.string().optional(),
  takeNumber: z.number().default(1),
  /** Relative to the project directory, same convention as managed Assets. */
  filePath: z.string(),
  originalFileName: z.string(),
  durationSeconds: z.number().optional(),
  integratedLufs: z.number().optional(),
  loudnessRangeLu: z.number().optional(),
  truePeakDbfs: z.number().optional(),
  waveformImagePath: z.string().optional(),
  status: VoiceTakeStatusSchema.default("draft"),
  notes: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type VoiceTake = z.infer<typeof VoiceTakeSchema>;
