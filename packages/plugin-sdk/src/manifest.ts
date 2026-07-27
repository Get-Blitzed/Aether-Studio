import { z } from "zod";

/**
 * What a plugin can register itself as. Only "text-provider" and
 * "image-provider" have a real consumer today (the provider registry in
 * @aether/ai-providers / the Providers screen); "export-target" is named
 * here so Phase 7's export pipeline can grow into the same contract
 * without a manifest shape change.
 */
export const PluginCapabilitySchema = z.enum(["text-provider", "image-provider", "export-target"]);
export type PluginCapability = z.infer<typeof PluginCapabilitySchema>;

export const PluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver (e.g. 1.0.0)"),
  description: z.string().optional(),
  publisher: z.string().optional(),
  capabilities: z.array(PluginCapabilitySchema).min(1),
  entryPoint: z.string().min(1),
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
