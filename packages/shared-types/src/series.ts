import { z } from "zod";

export const EpisodePlanSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string().min(1),
  objective: z.string().optional(),
  learningOutcomes: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  targetAudience: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  targetDurationSeconds: z.number().optional(),
  requiredDemonstrations: z.array(z.string()).default([]),
  dependsOnEpisodeIds: z.array(z.string()).default([]),
  callToAction: z.string().optional(),
  nextEpisodeTeaser: z.string().optional(),
  status: z.enum(["idea", "in-progress", "ready", "produced"]).default("idea"),
  notes: z.string().optional(),
  linkedProjectId: z.string().optional(),
});
export type EpisodePlan = z.infer<typeof EpisodePlanSchema>;

export const SeriesPlanSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  seasonTitle: z.string().optional(),
  recurringIntro: z.string().optional(),
  recurringOutro: z.string().optional(),
  recurringSegments: z.array(z.string()).default([]),
  episodes: z.array(EpisodePlanSchema).default([]),
  notes: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type SeriesPlan = z.infer<typeof SeriesPlanSchema>;
