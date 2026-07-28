import { z } from "zod";

export const QualityCheckStatusSchema = z.enum(["pass", "warning", "fail"]);
export type QualityCheckStatus = z.infer<typeof QualityCheckStatusSchema>;

/**
 * One result row from the Quality-Control Engine checklist -- a computed,
 * non-persisted value that crosses the main/renderer IPC boundary, so it
 * gets a schema like everything else that does (see ARCHITECTURE.md).
 */
export const QualityCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: QualityCheckStatusSchema,
  detail: z.string().optional(),
});
export type QualityCheck = z.infer<typeof QualityCheckSchema>;
