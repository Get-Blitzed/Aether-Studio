import { describe, expect, it } from "vitest";
import {
  StoryboardFrameSchema,
  PromptSchema,
  SeriesPlanSchema,
  AssetSchema,
  VoiceProfileSchema,
  VoiceTakeSchema,
  TimelineSchema,
  TimelineTrackSchema,
  TimelineClipSchema,
  BlurRegionSchema,
  isBlurTrackType,
  OverlayTemplateSchema,
  CaptionSchema,
  ProviderConfigSchema,
  BackgroundJobSchema,
  QualityCheckSchema,
  ScriptSegmentSchema,
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
      label: "Nova idle drift",
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
      title: "Orbit Missions",
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

describe("AssetSchema", () => {
  it("fills in defaults for a minimal managed asset", () => {
    const asset = AssetSchema.parse({
      id: "asset_1",
      category: "images",
      storageMode: "managed",
      filePath: "assets/images/nova.jpg",
      originalFileName: "nova.jpg",
      importedAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(asset.tags).toEqual([]);
    expect(asset.collections).toEqual([]);
    expect(asset.isFavorite).toBe(false);
    expect(asset.usageCount).toBe(0);
  });

  it("rejects an invalid category", () => {
    expect(() =>
      AssetSchema.parse({
        id: "asset_1",
        category: "not-a-real-category",
        storageMode: "managed",
        filePath: "x.jpg",
        originalFileName: "x.jpg",
        importedAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("rejects an invalid storage mode", () => {
    expect(() =>
      AssetSchema.parse({
        id: "asset_1",
        category: "images",
        storageMode: "cloud",
        filePath: "x.jpg",
        originalFileName: "x.jpg",
        importedAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("VoiceProfileSchema", () => {
  it("fills in defaults for a minimal profile", () => {
    const profile = VoiceProfileSchema.parse({
      id: "voice_1",
      name: "Nova",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(profile.name).toBe("Nova");
  });
});

describe("VoiceTakeSchema", () => {
  it("fills in defaults for a minimal take", () => {
    const take = VoiceTakeSchema.parse({
      id: "take_1",
      filePath: "audio/takes/take-1.wav",
      originalFileName: "take-1.wav",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(take.takeNumber).toBe(1);
    expect(take.status).toBe("draft");
  });

  it("rejects an invalid status", () => {
    expect(() =>
      VoiceTakeSchema.parse({
        id: "take_1",
        filePath: "audio/takes/take-1.wav",
        originalFileName: "take-1.wav",
        status: "not-a-real-status",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("TimelineTrackSchema and TimelineClipSchema", () => {
  it("fills in defaults for a minimal track", () => {
    const track = TimelineTrackSchema.parse({ id: "track_1", type: "primary-video", name: "Primary Video", order: 0 });
    expect(track.muted).toBe(false);
    expect(track.solo).toBe(false);
    expect(track.locked).toBe(false);
  });

  it("rejects an invalid track type", () => {
    expect(() => TimelineTrackSchema.parse({ id: "track_1", type: "not-a-real-type", name: "X", order: 0 })).toThrow();
  });

  it("fills in defaults for a minimal clip", () => {
    const clip = TimelineClipSchema.parse({
      id: "clip_1",
      trackId: "track_1",
      assetId: "asset_1",
      timelineStartSeconds: 0,
      timelineDurationSeconds: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(clip.sourceInSeconds).toBe(0);
    expect(clip.volume).toBe(1);
    expect(clip.opacity).toBe(1);
    expect(clip.fadeInSeconds).toBe(0);
  });

  it("accepts a 'blur' track type and identifies it via isBlurTrackType", () => {
    const track = TimelineTrackSchema.parse({ id: "track_blur", type: "blur", name: "Redactions", order: 2 });
    expect(isBlurTrackType(track.type)).toBe(true);
    expect(isBlurTrackType("primary-video")).toBe(false);
  });

  it("fills in a default blurStrength when a clip carries a blurRegion", () => {
    const clip = TimelineClipSchema.parse({
      id: "clip_blur",
      trackId: "track_blur",
      timelineStartSeconds: 0,
      timelineDurationSeconds: 5,
      blurRegion: { xPercent: 10, yPercent: 10, widthPercent: 30, heightPercent: 20 },
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(clip.blurRegion?.blurStrength).toBe(20);
  });

  it("rejects a blur region with an out-of-range percentage", () => {
    expect(() => BlurRegionSchema.parse({ xPercent: 10, yPercent: 10, widthPercent: 150, heightPercent: 20 })).toThrow();
  });
});

describe("TimelineSchema", () => {
  it("validates a timeline with tracks, clips, and markers", () => {
    const timeline = TimelineSchema.parse({
      id: "timeline_1",
      name: "Main Timeline",
      tracks: [{ id: "track_1", type: "primary-video", name: "Primary Video", order: 0 }],
      clips: [
        {
          id: "clip_1",
          trackId: "track_1",
          assetId: "asset_1",
          timelineStartSeconds: 0,
          timelineDurationSeconds: 5,
          createdAt: "2026-01-01T00:00:00.000Z",
          modifiedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      markers: [{ id: "marker_1", timeSeconds: 2, label: "Cold open ends" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(timeline.aspectRatio).toBe("16:9");
    expect(timeline.frameRate).toBe(30);
    expect(timeline.tracks).toHaveLength(1);
    expect(timeline.clips).toHaveLength(1);
    expect(timeline.markers).toHaveLength(1);
  });
});

describe("OverlayTemplateSchema", () => {
  it("fills in defaults for a minimal template", () => {
    const template = OverlayTemplateSchema.parse({
      id: "overlay_1",
      kind: "host-tip",
      name: "HOST TIP",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(template.position).toBe("bottom-center");
    expect(template.entryAnimation).toBe("fade");
  });

  it("rejects an invalid overlay kind", () => {
    expect(() =>
      OverlayTemplateSchema.parse({
        id: "overlay_1",
        kind: "not-a-real-kind",
        name: "X",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("CaptionSchema", () => {
  it("fills in defaults for a minimal caption", () => {
    const caption = CaptionSchema.parse({
      id: "caption_1",
      startSeconds: 0,
      endSeconds: 3,
      text: "Busy is not the same as productive.",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(caption.isSoundDescription).toBe(false);
  });
});

describe("ProviderConfigSchema", () => {
  it("fills in defaults for a minimal mock text provider", () => {
    const config = ProviderConfigSchema.parse({
      id: "provider_1",
      name: "Local Mock",
      kind: "mock",
      capability: "text",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(config.enabled).toBe(true);
    expect(config.isDefaultForCapability).toBe(false);
    expect(config.hasSecret).toBe(false);
  });

  it("rejects an invalid provider kind", () => {
    expect(() =>
      ProviderConfigSchema.parse({
        id: "provider_1",
        name: "X",
        kind: "not-a-real-kind",
        capability: "text",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("BackgroundJobSchema", () => {
  it("fills in defaults for a minimal job", () => {
    const job = BackgroundJobSchema.parse({
      id: "job_1",
      jobType: "generate-outline",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(job.status).toBe("queued");
    expect(job.progress).toBe(0);
  });

  it("validates a completed job with usage", () => {
    const job = BackgroundJobSchema.parse({
      id: "job_1",
      jobType: "generate-outline",
      status: "completed",
      progress: 1,
      usage: { promptTokens: 42, completionTokens: 128, estimatedCostUsd: 0.002 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(job.usage?.estimatedCostUsd).toBeCloseTo(0.002);
  });
});

describe("QualityCheckSchema", () => {
  it("validates a minimal check result", () => {
    const check = QualityCheckSchema.parse({ id: "unverified-claims", label: "Unverified claims", status: "pass" });
    expect(check.status).toBe("pass");
  });

  it("rejects an invalid status", () => {
    expect(() => QualityCheckSchema.parse({ id: "x", label: "X", status: "not-a-real-status" })).toThrow();
  });
});

describe("ScriptSegmentSchema reviewNotes (Phase 7)", () => {
  it("leaves reviewNotes undefined by default", () => {
    const segment = ScriptSegmentSchema.parse({ id: "seg_1", sceneNumber: 1 });
    expect(segment.reviewNotes).toBeUndefined();
  });

  it("accepts reviewNotes when provided", () => {
    const segment = ScriptSegmentSchema.parse({ id: "seg_1", sceneNumber: 1, reviewNotes: "Tighten the hook." });
    expect(segment.reviewNotes).toBe("Tighten the hook.");
  });
});

describe("ProjectManifestSchema (Phase 2-5 fields)", () => {
  it("defaults storyboardFrames, prompts, assets, voiceProfiles, voiceTakes, timelines, overlayTemplates, and captions to empty arrays", () => {
    const manifest = ProjectManifestSchema.parse({
      applicationVersion: "0.1.0-test",
      projectId: "proj_1",
      title: "Test Production",
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(manifest.storyboardFrames).toEqual([]);
    expect(manifest.prompts).toEqual([]);
    expect(manifest.assets).toEqual([]);
    expect(manifest.voiceProfiles).toEqual([]);
    expect(manifest.voiceTakes).toEqual([]);
    expect(manifest.timelines).toEqual([]);
    expect(manifest.overlayTemplates).toEqual([]);
    expect(manifest.captions).toEqual([]);
  });

  it("still validates a manifest saved before Phase 2 (no storyboardFrames/prompts/assets/timelines keys at all)", () => {
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
