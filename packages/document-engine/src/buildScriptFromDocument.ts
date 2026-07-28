import { generateId, nowIso } from "@aether/core";
import type { Script, ScriptSegment, StoryboardFrame } from "@aether/shared-types";

export interface DocumentToScriptResult {
  script: Script;
  storyboardFrames: StoryboardFrame[];
}

/**
 * Builds a real Script (one segment per page/slide, narration = that
 * page's extracted text) and matching StoryboardFrames from a document's
 * extracted pages -- a pure, deterministic transform with no ffmpeg/AI
 * involved, so it's fully unit-testable on its own.
 */
export function buildScriptFromDocument(pages: string[], documentTitle: string): DocumentToScriptResult {
  const timestamp = nowIso();
  const segments: ScriptSegment[] = pages.map((pageText, i) => ({
    id: generateId("seg"),
    sceneNumber: i + 1,
    sceneTitle: `Page ${i + 1}`,
    narration: pageText,
    approvalStatus: "draft",
    unverifiedClaim: false,
    soundEffects: [],
    sourceCitationIds: [],
  }));

  const script: Script = {
    id: generateId("script"),
    title: `${documentTitle} (from document)`,
    narrationSpeedWpm: 130,
    segments,
    revision: 1,
    createdAt: timestamp,
    modifiedAt: timestamp,
  };

  const storyboardFrames: StoryboardFrame[] = pages.map((pageText, i) => ({
    id: generateId("frame"),
    sceneNumber: i + 1,
    shotNumber: 1,
    shotType: "title-card",
    sceneDescription: pageText.slice(0, 200),
    linkedScriptSegmentId: segments[i]!.id,
    productionStatus: "draft",
    props: [],
    interfaceElements: [],
    createdAt: timestamp,
    modifiedAt: timestamp,
  }));

  return { script, storyboardFrames };
}
