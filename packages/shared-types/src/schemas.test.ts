import { describe, expect, it } from "vitest";
import {
  StoryboardFrameSchema,
  PromptSchema,
  SeriesPlanSchema,
  ProjectManifestSchema,
} from "./index.js";

describe("StoryboardFrameSchema", () => {
  it("fills in defaults for a minimal frame", () => {
    const frame = StoryboardFrameSchema.parse({
      id: "frame_1",
      sceneNumber: 1,
      shotNumber: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(frame.shotType).toBe("medium");
    expect(frame.productionStatus).toBe("draft");
    expect(frame.props).toEqual([]);
  });

  it("rejects an invalid shot type", () => {
    expect(() =>
      StoryboardFrameSchema.parse({
        id: "frame_1",
        sceneNumber: 1,
        shotNumber: 1,
        shotType: "not-a-real-shot-type",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("PromptSchema", () => {
  it("fills in defaults for a minimal prompt", () => {
    const prompt = PromptSchema.parse({
      id: "prompt_1",
      label: "Blitz idle presenter",
      category: "character-animation",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(prompt.status).toBe("draft");
    expect(prompt.providerSpecificOptions).toEqual({});
  });
});

describe("SeriesPlanSchema", () => {
  it("validates a curriculum with ordered episodes", () => {
    const plan = SeriesPlanSchema.parse({
      id: "series_1",
      title: "A.I. Blitz Missions",
      episodes: [
        { id: "ep_1", order: 1, title: "Mission 001" },
        { id: "ep_2", order: 2, title: "Mission 002", difficulty: "intermediate" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(plan.episodes).toHaveLength(2);
    expect(plan.episodes[0]?.difficulty).toBe("beginner");
    expect(plan.episodes[1]?.difficulty).toBe("intermediate");
  });
});

describe("ProjectManifestSchema (Phase 2 fields)", () => {
  it("defaults storyboardFrames and prompts to empty arrays", () => {
    const manifest = ProjectManifestSchema.parse({
      applicationVersion: "0.1.0-test",
      projectId: "proj_1",
      title: "Test Production",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(manifest.storyboardFrames).toEqual([]);
    expect(manifest.prompts).toEqual([]);
  });

  it("still validates a manifest saved before Phase 2 (no storyboardFrames/prompts keys at all)", () => {
    const legacyManifest = {
      formatVersion: 1,
      applicationVersion: "0.1.0-phase1",
      projectId: "proj_legacy",
      title: "Phase 1 Production",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
      productionSettings: {},
      brands: [],
      characters: [],
      knowledgeSources: [],
      scripts: [],
      tasks: [],
      providerReferences: [],
    };
    const result = ProjectManifestSchema.safeParse(legacyManifest);
    expect(result.success).toBe(true);
  });
});
