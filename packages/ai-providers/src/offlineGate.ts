import type { ProviderKind } from "@aether/shared-types";
import { AiProviderError } from "./errors.js";

const OFFLINE_SAFE_KINDS = new Set<ProviderKind>(["mock", "sapi-voice", "piper-voice"]);

/**
 * Enforces Settings > Offline Mode: any provider kind that makes a real
 * network call must be refused while offline mode is on. The mock provider,
 * the native Windows SAPI voice provider, and the bundled offline Piper
 * voice provider never touch the network, so they're exempt -- this is the
 * one place that distinction is made, rather than duplicating an offline
 * check inside every networked provider implementation.
 */
export function assertNotBlockedByOfflineMode(kind: ProviderKind, offlineMode: boolean): void {
  if (OFFLINE_SAFE_KINDS.has(kind)) return;
  if (!offlineMode) return;
  throw new AiProviderError(
    `Offline mode is enabled in Settings, so the "${kind}" provider (which requires network access) was not called.`,
    "OFFLINE_MODE_BLOCKED",
  );
}
