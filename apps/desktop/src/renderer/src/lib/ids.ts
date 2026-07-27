// Renderer-side id/timestamp helpers. Deliberately not importing
// @aether/core here: it pulls in node:fs (paths.ts, logger.ts), which has no
// place in a browser-target Vite bundle.
export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
