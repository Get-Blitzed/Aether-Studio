import { z } from "zod";

export const CaptionSchema = z.object({
  id: z.string(),
  scriptSegmentId: z.string().optional(),
  startSeconds: z.number(),
  endSeconds: z.number(),
  text: z.string(),
  speakerLabel: z.string().optional(),
  isSoundDescription: z.boolean().default(false),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type Caption = z.infer<typeof CaptionSchema>;
