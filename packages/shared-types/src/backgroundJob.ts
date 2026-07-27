import { z } from "zod";

export const BackgroundJobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type BackgroundJobStatus = z.infer<typeof BackgroundJobStatusSchema>;

export const JobUsageSchema = z.object({
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  estimatedCostUsd: z.number().default(0),
});
export type JobUsage = z.infer<typeof JobUsageSchema>;

export const BackgroundJobSchema = z.object({
  id: z.string(),
  jobType: z.string(),
  providerId: z.string().optional(),
  providerName: z.string().optional(),
  status: BackgroundJobStatusSchema.default("queued"),
  progress: z.number().min(0).max(1).default(0),
  currentStep: z.string().optional(),
  error: z.string().optional(),
  outputLocation: z.string().optional(),
  usage: JobUsageSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BackgroundJob = z.infer<typeof BackgroundJobSchema>;
