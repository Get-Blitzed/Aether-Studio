import { z } from "zod";

export const BrandSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  companyOrProductName: z.string().optional(),
  logoVariants: z.array(z.string()).default([]),
  logoPlacementRules: z.string().optional(),
  colorPalette: z
    .array(
      z.object({
        name: z.string(),
        hex: z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/),
      }),
    )
    .default([]),
  typography: z
    .object({
      headingFont: z.string().optional(),
      bodyFont: z.string().optional(),
    })
    .default({}),
  voiceAndTone: z.string().optional(),
  approvedTerminology: z.array(z.string()).default([]),
  prohibitedTerminology: z.array(z.string()).default([]),
  productCapitalizationRules: z.array(z.string()).default([]),
  legalNotices: z.array(z.string()).default([]),
  disclaimers: z.array(z.string()).default([]),
  accessibilityRequirements: z.array(z.string()).default([]),
  watermark: z.string().optional(),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type Brand = z.infer<typeof BrandSchema>;
