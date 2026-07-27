import { z } from "zod";

export const PromptCategorySchema = z.enum([
  "language-generation",
  "image-generation",
  "image-to-video",
  "text-to-video",
  "character-animation",
  "scene-extension",
  "camera-motion",
  "background-replacement",
  "voice-generation",
  "music-generation",
  "sound-effect-generation",
  "thumbnail-generation",
  "captions",
  "translation",
]);
export type PromptCategory = z.infer<typeof PromptCategorySchema>;

export const PromptStatusSchema = z.enum(["draft", "approved", "deprecated"]);
export type PromptStatus = z.infer<typeof PromptStatusSchema>;

export const PromptSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  category: PromptCategorySchema,
  provider: z.string().optional(),
  model: z.string().optional(),
  purpose: z.string().optional(),
  subject: z.string().optional(),
  characterReferenceId: z.string().optional(),
  action: z.string().optional(),
  environment: z.string().optional(),
  composition: z.string().optional(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  lighting: z.string().optional(),
  mood: z.string().optional(),
  visualStyle: z.string().optional(),
  movement: z.string().optional(),
  durationSeconds: z.number().optional(),
  frameRate: z.number().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  continuityRequirements: z.string().optional(),
  negativePrompt: z.string().optional(),
  providerSpecificOptions: z.record(z.string(), z.string()).default({}),
  status: PromptStatusSchema.default("draft"),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
  linkedStoryboardFrameId: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type Prompt = z.infer<typeof PromptSchema>;
