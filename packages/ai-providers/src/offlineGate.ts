import type { ProviderKind } from "@aether/shared-types";
import { AiProviderError } from "./errors.js";

/**
 * Enforces Settings > Offline Mode: any provider kind that makes a real
 * network call must be refused while offline mode is on. The mock provider
 * never touches the network, so it is exempt -- this is the one place that
 * distinction is made, rather than duplicating an offline check inside
 * every networked provider implementation.
 */
export function assertNotBlockedByOfflineMode(kind: ProviderKind, offlineMode: boolean): void {
  if (kind === "mock") return;
  if (!offlineMode) return;
  throw new AiProviderError(
    `Offline mode is enabled in Settings, so the "${kind}" provider (which requires network access) was not called.`,
    "OFFLINE_MODE_BLOCKED",
  );
}
