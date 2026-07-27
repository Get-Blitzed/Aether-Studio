import type { AetherDatabase } from "../db.js";
import { BackgroundJobSchema, type BackgroundJob } from "@aether/shared-types";

interface BackgroundJobRow {
  id: string;
  job_type: string;
  provider_id: string | null;
  provider_name: string | null;
  status: string;
  progress: number;
  current_step: string | null;
  error: string | null;
  output_location: string | null;
  usage_json: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: BackgroundJobRow): BackgroundJob {
  return BackgroundJobSchema.parse({
    id: row.id,
    jobType: row.job_type,
    providerId: row.provider_id ?? undefined,
    providerName: row.provider_name ?? undefined,
    status: row.status,
    progress: row.progress,
    currentStep: row.current_step ?? undefined,
    error: row.error ?? undefined,
    outputLocation: row.output_location ?? undefined,
    usage: row.usage_json ? JSON.parse(row.usage_json) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class BackgroundJobRepository {
  constructor(private readonly db: AetherDatabase) {}

  listRecent(limit = 20): BackgroundJob[] {
    return this.db.raw
      .prepare("SELECT * FROM background_jobs ORDER BY created_at DESC LIMIT ?")
      .all<BackgroundJobRow>(limit)
      .map(rowToJob);
  }

  save(job: BackgroundJob): BackgroundJob {
    const validated = BackgroundJobSchema.parse(job);
    this.db.raw
      .prepare(
        `INSERT INTO background_jobs
           (id, job_type, provider_id, provider_name, status, progress, current_step, error, output_location, usage_json, created_at, updated_at)
         VALUES (@id, @jobType, @providerId, @providerName, @status, @progress, @currentStep, @error, @outputLocation, @usageJson, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           progress = excluded.progress,
           current_step = excluded.current_step,
           error = excluded.error,
           output_location = excluded.output_location,
           usage_json = excluded.usage_json,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: validated.id,
        jobType: validated.jobType,
        providerId: validated.providerId ?? null,
        providerName: validated.providerName ?? null,
        status: validated.status,
        progress: validated.progress,
        currentStep: validated.currentStep ?? null,
        error: validated.error ?? null,
        outputLocation: validated.outputLocation ?? null,
        usageJson: validated.usage ? JSON.stringify(validated.usage) : null,
        createdAt: validated.createdAt,
        updatedAt: validated.updatedAt,
      });
    return validated;
  }
}
