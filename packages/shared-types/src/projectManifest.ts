import { z } from "zod";
import { ProductionTypeSchema, ProductionStageSchema, AspectRatioSchema } from "./enums.js";
import { CharacterSchema } from "./character.js";
import { BrandSchema } from "./brand.js";
import { ScriptSchema } from "./script.js";
import { StoryboardFrameSchema } from "./storyboard.js";
import { PromptSchema } from "./prompt.js";
import { AssetSchema } from "./asset.js";
import { VoiceProfileSchema, VoiceTakeSchema } from "./voice.js";

export const AETHER_PROJECT_FORMAT_VERSION = 1;

export const ProductionSettingsSchema = z.object({
  clientName: z.string().optional(),
  productName: z.string().optional(),
  productionType: ProductionTypeSchema.default("custom"),
  series: z.string().optional(),
  episode: z.string().optional(),
  targetAudience: z.string().optional(),
  primaryObjective: z.string().optional(),
  targetDurationSeconds: z.number().optional(),
  outputFormat: z.string().default("mp4"),
  aspectRatio: AspectRatioSchema.default("16:9"),
  frameRate: z.number().default(30),
  dueDate: z.string().optional(),
  stage: ProductionStageSchema.default("idea"),
  confidential: z.boolean().default(false),
});
export type ProductionSettings = z.infer<typeof ProductionSettingsSchema>;

export const KnowledgeSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceType: z.string(),
  originalLocation: z.string().optional(),
  addedAt: z.string(),
  publicationDate: z.string().optional(),
  reviewedAt: z.string().optional(),
  productVersion: z.string().optional(),
  status: z.string().default("unreviewed"),
  reliability: z.string().optional(),
  owner: z.string().optional(),
  notes: z.string().optional(),
  bodyText: z.string().optional(),
  verifiedClaims: z.array(z.string()).default([]),
  prohibitedClaims: z.array(z.string()).default([]),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const TaskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["open", "in-progress", "done"]).default("open"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
  notes: z.string().optional(),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;

/**
 * Root manifest for a .aether project (project.aether).
 * Provider secrets must never be stored here -- only opaque providerReferences (ids).
 */
export const ProjectManifestSchema = z.object({
  formatVersion: z.number().default(AETHER_PROJECT_FORMAT_VERSION),
  applicationVersion: z.string(),
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
  productionSettings: ProductionSettingsSchema.default({}),
  brands: z.array(BrandSchema).default([]),
  characters: z.array(CharacterSchema).default([]),
  knowledgeSources: z.array(KnowledgeSourceSchema).default([]),
  scripts: z.array(ScriptSchema).default([]),
  storyboardFrames: z.array(StoryboardFrameSchema).default([]),
  prompts: z.array(PromptSchema).default([]),
  assets: z.array(AssetSchema).default([]),
  voiceProfiles: z.array(VoiceProfileSchema).default([]),
  voiceTakes: z.array(VoiceTakeSchema).default([]),
  tasks: z.array(TaskItemSchema).default([]),
  providerReferences: z.array(z.string()).default([]),
});
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>;

export const RecentProjectEntrySchema = z.object({
  projectId: z.string(),
  title: z.string(),
  manifestPath: z.string(),
  lastOpenedAt: z.string(),
});
export type RecentProjectEntry = z.infer<typeof RecentProjectEntrySchema>;
