import { z } from "zod";

export const AppSettingsSchema = z.object({
  appearance: z.enum(["dark", "light", "system"]).default("dark"),
  accentColor: z.string().default("#3E8EF7"),
  uiScale: z.number().min(0.8).max(1.5).default(1),
  language: z.string().default("en-US"),
  defaultProjectFolder: z.string().optional(),
  autosaveIntervalSeconds: z.number().min(10).default(60),
  backupCount: z.number().min(1).default(10),
  cacheLocation: z.string().optional(),
  cacheSizeLimitMb: z.number().default(4096),
  ffmpegPath: z.string().optional(),
  hardwareAcceleration: z.boolean().default(true),
  defaultResolution: z.string().default("1920x1080"),
  defaultFrameRate: z.number().default(30),
  defaultAspectRatio: z.string().default("16:9"),
  defaultNarrationSpeedWpm: z.number().default(130),
  defaultCaptionStyle: z.string().default("standard"),
  defaultExportPreset: z.string().default("youtube-1080p"),
  offlineMode: z.boolean().default(false),
  diagnosticsOptIn: z.boolean().default(false),
  logRetentionDays: z.number().default(30),
  confidentialModeDefault: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = AppSettingsSchema.parse({});
