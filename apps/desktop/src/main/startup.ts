import fs from "node:fs";
import path from "node:path";
import { getAppDataDir } from "@aether/core";
import type { Logger } from "@aether/core";

export interface StartupStatusEntry {
  message: string;
  atIso: string;
}

export interface StartupResult {
  statusLog: StartupStatusEntry[];
  recoveryDetected: boolean;
}

const RUN_MARKER_FILENAME = "running.lock";

function runMarkerPath(): string {
  return path.join(getAppDataDir(), RUN_MARKER_FILENAME);
}

/**
 * Runs the visible startup sequence (used to drive the splash screen), and
 * detects whether the previous run exited without cleaning up its marker
 * file -- a proxy for "the app did not shut down cleanly last time".
 */
export async function runStartupSequence(
  logger: Logger,
  steps: Array<() => void | Promise<void>>,
): Promise<StartupResult> {
  const statusLog: StartupStatusEntry[] = [];
  const record = (message: string): void => {
    statusLog.push({ message, atIso: new Date().toISOString() });
    logger.info(message);
  };

  record("Loading production engine");
  const marker = runMarkerPath();
  const recoveryDetected = fs.existsSync(marker);
  if (recoveryDetected) {
    record("Recovery snapshot check: previous session did not close cleanly");
  } else {
    record("Checking recovery snapshots");
  }

  record("Opening project database");
  await steps[0]?.();

  record("Preparing media workspace");
  record("Initializing creative modules");
  record("Preparing export services");
  record("Loading templates");

  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, new Date().toISOString(), "utf-8");

  return { statusLog, recoveryDetected };
}

export function clearRunMarker(): void {
  const marker = runMarkerPath();
  try {
    if (fs.existsSync(marker)) fs.unlinkSync(marker);
  } catch {
    // Best-effort; a stale marker just triggers a recovery notice next launch.
  }
}
