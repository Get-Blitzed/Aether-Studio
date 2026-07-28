import { describe, expect, it } from "vitest";
import { buildScriptFromDocument } from "./buildScriptFromDocument.js";

describe("buildScriptFromDocument", () => {
  it("creates one segment and one storyboard frame per page", () => {
    const { script, storyboardFrames } = buildScriptFromDocument(["Page one text.", "Page two text."], "My Document");
    expect(script.segments).toHaveLength(2);
    expect(storyboardFrames).toHaveLength(2);
    expect(script.segments[0]?.narration).toBe("Page one text.");
    expect(script.segments[1]?.sceneNumber).toBe(2);
  });

  it("links each storyboard frame to its script segment", () => {
    const { script, storyboardFrames } = buildScriptFromDocument(["A", "B"], "Doc");
    expect(storyboardFrames[0]?.linkedScriptSegmentId).toBe(script.segments[0]?.id);
    expect(storyboardFrames[1]?.linkedScriptSegmentId).toBe(script.segments[1]?.id);
  });

  it("titles the script after the source document", () => {
    const { script } = buildScriptFromDocument(["A"], "Quarterly Report");
    expect(script.title).toContain("Quarterly Report");
  });
});
