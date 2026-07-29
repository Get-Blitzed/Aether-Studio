import { useEffect } from "react";
import { useAppStore } from "../state/appStore";
import { applyAppearance } from "./theme";

/**
 * Applies Settings > Appearance to the document root whenever the saved
 * setting changes. "system" tracks the OS's prefers-color-scheme live, so
 * switching OS theme while the setting is "system" updates the app
 * immediately without a restart. See lib/theme.ts's `applyAppearance` for
 * the actual class-toggling logic, also used by Settings screen's live
 * preview of an in-progress (not-yet-saved) choice.
 */
export function useAppliedTheme(): void {
  const appearance = useAppStore((s) => s.settings?.appearance) ?? "dark";

  useEffect(() => {
    if (appearance !== "system") {
      applyAppearance(appearance);
      return undefined;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyAppearance(appearance, media.matches);
    const listener = (e: MediaQueryListEvent) => applyAppearance(appearance, e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [appearance]);
}
