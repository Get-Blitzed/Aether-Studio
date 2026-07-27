import { z } from "zod";

export const CharacterReferenceCategorySchema = z.enum([
  "front-view",
  "left-side-view",
  "right-side-view",
  "rear-view",
  "full-body-view",
  "close-up",
  "action-pose",
  "alternate-wardrobe",
  "emotion-or-state",
]);
export type CharacterReferenceCategory = z.infer<typeof CharacterReferenceCategorySchema>;

export const CharacterReferenceSchema = z.object({
  id: z.string(),
  category: CharacterReferenceCategorySchema,
  filePath: z.string(),
  approved: z.boolean().default(false),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type CharacterReference = z.infer<typeof CharacterReferenceSchema>;

export const CharacterConsistencyLocksSchema = z.object({
  referenceLock: z.boolean().default(false),
  costumeLock: z.boolean().default(false),
  colorLock: z.boolean().default(false),
  silhouetteLock: z.boolean().default(false),
  maskLock: z.boolean().default(false),
  hairstyleLock: z.boolean().default(false),
  accessoryLock: z.boolean().default(false),
});
export type CharacterConsistencyLocks = z.infer<typeof CharacterConsistencyLocksSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  role: z.string().optional(),
  biography: z.string().optional(),
  characterType: z.string().optional(),
  personality: z.string().optional(),
  speakingStyle: z.string().optional(),
  visualDescription: z.string().optional(),
  agePresentation: z.string().optional(),
  heightAndProportions: z.string().optional(),
  wardrobe: z.array(z.string()).default([]),
  colors: z.array(z.string()).default([]),
  materials: z.array(z.string()).default([]),
  props: z.array(z.string()).default([]),
  signatureGestures: z.array(z.string()).default([]),
  signaturePoses: z.array(z.string()).default([]),
  allowedEmotions: z.array(z.string()).default([]),
  prohibitedBehaviors: z.array(z.string()).default([]),
  cameraRules: z.array(z.string()).default([]),
  lightingRules: z.array(z.string()).default([]),
  animationRestrictions: z.array(z.string()).default([]),
  assignedVoiceId: z.string().optional(),
  requiresLipSync: z.boolean().default(true),
  references: z.array(CharacterReferenceSchema).default([]),
  locks: CharacterConsistencyLocksSchema.default({}),
  versionHistory: z
    .array(
      z.object({
        version: z.number(),
        savedAt: z.string(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type Character = z.infer<typeof CharacterSchema>;
