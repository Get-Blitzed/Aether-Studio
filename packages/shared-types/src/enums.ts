import { z } from "zod";

export const ProductionTypeSchema = z.enum([
  "product-introduction",
  "software-tutorial",
  "onboarding-lesson",
  "feature-demonstration",
  "internal-training",
  "course-lesson",
  "marketing-video",
  "explainer",
  "announcement",
  "social-media-video",
  "custom",
]);
export type ProductionType = z.infer<typeof ProductionTypeSchema>;

export const ProductionStageSchema = z.enum([
  "idea",
  "research",
  "outline",
  "script",
  "storyboard",
  "asset-creation",
  "voice-production",
  "screen-capture",
  "animation",
  "assembly",
  "internal-review",
  "client-review",
  "approved",
  "exported",
  "archived",
]);
export type ProductionStage = z.infer<typeof ProductionStageSchema>;

export const AspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:5", "custom"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const SourceStatusSchema = z.enum([
  "unreviewed",
  "verified",
  "partially-verified",
  "outdated",
  "conflicting",
  "archived",
]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const ReviewStatusSchema = z.enum([
  "not-reviewed",
  "internal-review",
  "client-review",
  "changes-requested",
  "approved",
  "approved-with-notes",
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
