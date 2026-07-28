import { z } from "zod";

export const ProviderKindSchema = z.enum(["mock", "openai-compatible", "generic-rest", "sapi-voice", "elevenlabs"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderCapabilitySchema = z.enum(["text", "image", "voice"]);
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;

/**
 * The renderer-visible shape of a configured AI provider. Never carries the
 * actual secret value -- `hasSecret` only indicates whether one is stored
 * (encrypted, main-process only) alongside this config.
 */
export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ProviderKindSchema,
  capability: ProviderCapabilitySchema,
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  requestTemplate: z.string().optional(),
  enabled: z.boolean().default(true),
  isDefaultForCapability: z.boolean().default(false),
  hasSecret: z.boolean().default(false),
  createdAt: z.string(),
  modifiedAt: z.string(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
