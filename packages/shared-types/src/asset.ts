import { z } from "zod";

export const AssetCategorySchema = z.enum([
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
]);
export type AssetCategory = z.infer<typeof AssetCategorySchema>;

/**
 * "managed" = the app copied the file into the project's /assets tree and
 * owns that copy (safe to delete when the asset is removed from the
 * library). "linked" = the file stays wherever the user's original lives;
 * the app only ever reads it and must never move, rename, or delete it.
 */
export const AssetStorageModeSchema = z.enum(["managed", "linked"]);
export type AssetStorageMode = z.infer<typeof AssetStorageModeSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  category: AssetCategorySchema,
  storageMode: AssetStorageModeSchema,
  /** Managed: path relative to the project directory. Linked: absolute path. */
  filePath: z.string(),
  originalFileName: z.string(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  checksumSha256: z.string().optional(),
  durationSeconds: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  /** Relative to the project directory, like filePath when managed. */
  thumbnailPath: z.string().optional(),
  waveformImagePath: z.string().optional(),
  tags: z.array(z.string()).default([]),
  collections: z.array(z.string()).default([]),
  isFavorite: z.boolean().default(false),
  usageCount: z.number().default(0),
  sourceAttribution: z.string().optional(),
  licenseNotes: z.string().optional(),
  usageRestrictions: z.string().optional(),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
  importedAt: z.string(),
  modifiedAt: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;
