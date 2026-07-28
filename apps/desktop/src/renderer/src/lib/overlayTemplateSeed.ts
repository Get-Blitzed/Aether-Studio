import type { OverlayTemplate, OverlayTemplateKind } from "@aether/shared-types";
import { generateId, nowIso } from "./ids";

interface SeedSpec {
  kind: OverlayTemplateKind;
  name: string;
  defaultText: string;
  position: OverlayTemplate["position"];
  backgroundColor: string;
}

const STANDARD_TEMPLATES: SeedSpec[] = [
  { kind: "opening-title", name: "Opening Title", defaultText: "PRODUCTION TITLE", position: "center", backgroundColor: "#131A2BE6" },
  { kind: "episode-title", name: "Episode Title", defaultText: "Episode Title", position: "center", backgroundColor: "#131A2BE6" },
  { kind: "scene-title", name: "Scene Title", defaultText: "Scene Title", position: "top-left", backgroundColor: "#131A2BCC" },
  { kind: "lower-third", name: "Lower Third", defaultText: "Name / Role", position: "bottom-left", backgroundColor: "#131A2BCC" },
  { kind: "host-tip", name: "HOST TIP", defaultText: "Start with one problem you understand well.", position: "bottom-center", backgroundColor: "#FFB020CC" },
  { kind: "important", name: "IMPORTANT", defaultText: "Important information", position: "bottom-center", backgroundColor: "#7A2E2ECC" },
  { kind: "warning", name: "WARNING", defaultText: "Warning", position: "bottom-center", backgroundColor: "#7A2E2ECC" },
  { kind: "step-number", name: "Step Number", defaultText: "Step 1", position: "top-right", backgroundColor: "#131A2BCC" },
  { kind: "keyboard-shortcut", name: "Keyboard Shortcut", defaultText: "Ctrl + S", position: "bottom-right", backgroundColor: "#131A2BCC" },
  { kind: "feature-highlight", name: "Feature Highlight", defaultText: "Feature name", position: "top-center", backgroundColor: "#3E8EF7CC" },
  { kind: "mission-objective", name: "MISSION OBJECTIVE", defaultText: "Set up your first workspace.", position: "top-center", backgroundColor: "#131A2BE6" },
  { kind: "system-check", name: "SYSTEM CHECK", defaultText: "Checking requirements...", position: "center", backgroundColor: "#131A2BE6" },
  { kind: "mission-complete", name: "MISSION COMPLETE", defaultText: "Mission Complete", position: "center", backgroundColor: "#2E7A4FCC" },
  { kind: "next-mission", name: "NEXT OBJECTIVE", defaultText: "Next: Creating Your First Workspace", position: "bottom-center", backgroundColor: "#131A2BE6" },
  { kind: "call-to-action", name: "Call to Action", defaultText: "Subscribe for the next mission", position: "bottom-center", backgroundColor: "#3E8EF7CC" },
  { kind: "end-screen", name: "End Screen", defaultText: "Thanks for watching", position: "center", backgroundColor: "#131A2BE6" },
];

/** Sample editable overlay template set from spec section 20 -- not a hard-coded limitation. */
export function buildStandardOverlayTemplates(): OverlayTemplate[] {
  const timestamp = nowIso();
  return STANDARD_TEMPLATES.map((spec) => ({
    id: generateId("overlay"),
    kind: spec.kind,
    name: spec.name,
    defaultText: spec.defaultText,
    fontColor: "#F4EFE6",
    backgroundColor: spec.backgroundColor,
    position: spec.position,
    suggestedDurationSeconds: 4,
    entryAnimation: "fade" as const,
    exitAnimation: "fade" as const,
    createdAt: timestamp,
    modifiedAt: timestamp,
  }));
}
