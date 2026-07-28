import { describe, expect, it } from "vitest";
import { runQualityChecklist } from "./qualityChecklist.js";
import type { ProjectManifest } from "@aether/shared-types";

function baseManifest(overrides: Partial<ProjectManifest> = {}): ProjectManifest {
  const timestamp = "2026-01-01T00:00:00.000Z";
  return {
    formatVersion: 1,
    applicationVersion: "0.1.0-test",
    projectId: "proj_1",
    title: "Test Production",
    createdAt: timestamp,
    modifiedAt: timestamp,
    productionSettings: {
      productionType: "custom",
      outputFormat: "mp4",
      aspectRatio: "16:9",
      frameRate: 30,
      stage: "idea",
      confidential: false,
    },
    brands: [],
    characters: [],
    knowledgeSources: [],
    scripts: [],
    storyboardFrames: [],
    prompts: [],
    assets: [],
    voiceProfiles: [],
    voiceTakes: [],
    timelines: [],
    overlayTemplates: [],
    captions: [],
    tasks: [],
    providerReferences: [],
    ...overrides,
  };
}

describe("runQualityChecklist", () => {
  it("flags a brand-new, empty production with warnings/fails but no crash", () => {
    const results = runQualityChecklist(baseManifest());
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId["timeline-exists"]?.status).toBe("fail");
    expect(byId["primary-video-track"]?.status).toBe("fail");
    expect(byId["scenes-approved"]?.status).toBe("warning");
    expect(byId["captions-present"]?.status).toBe("warning");
  });

  it("fails unverified-claims when a segment is flagged", () => {
    const manifest = baseManifest({
      scripts: [
        {
          id: "script_1",
          title: "S",
          narrationSpeedWpm: 130,
          segments: [{ id: "seg_1", sceneNumber: 1, unverifiedClaim: true, approvalStatus: "draft", soundEffects: [], sourceCitationIds: [] }],
          revision: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          modifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const results = runQualityChecklist(manifest);
    expect(results.find((r) => r.id === "unverified-claims")?.status).toBe("fail");
  });

  it("passes scenes-approved once every segment is approved", () => {
    const manifest = baseManifest({
      scripts: [
        {
          id: "script_1",
          title: "S",
          narrationSpeedWpm: 130,
          segments: [{ id: "seg_1", sceneNumber: 1, unverifiedClaim: false, approvalStatus: "approved", soundEffects: [], sourceCitationIds: [] }],
          revision: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          modifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const results = runQualityChecklist(manifest);
    expect(results.find((r) => r.id === "scenes-approved")?.status).toBe("pass");
  });

  it("fails no-orphaned-clip-assets when a clip references a deleted asset", () => {
    const manifest = baseManifest({
      timelines: [
        {
          id: "t1",
          name: "Timeline 1",
          aspectRatio: "16:9",
          frameRate: 30,
          tracks: [{ id: "track_1", type: "primary-video", name: "Primary Video", order: 0, muted: false, solo: false, locked: false }],
          clips: [
            {
              id: "clip_1",
              trackId: "track_1",
              assetId: "asset_missing",
              sourceInSeconds: 0,
              timelineStartSeconds: 0,
              timelineDurationSeconds: 5,
              volume: 1,
              opacity: 1,
              fadeInSeconds: 0,
              fadeOutSeconds: 0,
              muted: false,
              locked: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              modifiedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          markers: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          modifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      assets: [],
    });
    const results = runQualityChecklist(manifest);
    expect(results.find((r) => r.id === "no-orphaned-clip-assets")?.status).toBe("fail");
    expect(results.find((r) => r.id === "primary-video-track")?.status).toBe("pass");
  });
});
