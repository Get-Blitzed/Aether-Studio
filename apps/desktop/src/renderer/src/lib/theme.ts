import type { AppSettings } from "@aether/shared-types";

/** Resolves and applies a theme choice to the document root -- shared by the app-wide effect (driven by saved settings) and Settings screen's live preview (driven by the in-progress, not-yet-saved dropdown value). */
export function applyAppearance(appearance: AppSettings["appearance"], prefersDarkOverride?: boolean): void {
  const prefersDark = prefersDarkOverride ?? window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = appearance === "system" ? (prefersDark ? "dark" : "light") : appearance;
  document.documentElement.classList.toggle("light", resolved === "light");
}
