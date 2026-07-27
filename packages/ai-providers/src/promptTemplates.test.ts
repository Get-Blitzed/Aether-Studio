import { describe, expect, it } from "vitest";
import { buildStructuredPrompt, parseStructuredPrompt } from "./promptTemplates.js";

describe("buildStructuredPrompt / parseStructuredPrompt", () => {
  it("round-trips a task and its fields", () => {
    const prompt = buildStructuredPrompt("outline", { title: "Mission 001", scene_count: 5 });
    const parsed = parseStructuredPrompt(prompt);
    expect(parsed.task).toBe("outline");
    expect(parsed.fields.title).toBe("Mission 001");
    expect(parsed.fields.scene_count).toBe("5");
  });

  it("omits undefined fields", () => {
    const prompt = buildStructuredPrompt("improve-hook", { current: "Hello", missing: undefined });
    expect(prompt).not.toContain("MISSING");
  });

  it("defaults to task 'generic' for unstructured text", () => {
    const parsed = parseStructuredPrompt("just some plain text with no keys");
    expect(parsed.task).toBe("generic");
  });
});
