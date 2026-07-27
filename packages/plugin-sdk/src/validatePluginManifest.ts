import { PluginManifestSchema, type PluginManifest } from "./manifest.js";

export type PluginManifestValidation =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

/**
 * Validates a plugin's manifest.json contents against the schema every
 * future plugin must satisfy. There is deliberately no loader here yet --
 * this package only defines and validates the contract (spec section 44's
 * "prepare clean interfaces for future expansion" without a runtime that
 * would load and execute arbitrary third-party code before the security
 * model for that exists).
 */
export function validatePluginManifest(candidate: unknown): PluginManifestValidation {
  const result = PluginManifestSchema.safeParse(candidate);
  if (result.success) return { ok: true, manifest: result.data };
  return { ok: false, errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
}
