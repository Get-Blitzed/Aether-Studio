import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { locateFfmpeg, runProcess, probeMedia } from "@aether/media-engine";
import { renderFinalExport } from "./renderFinalExport.js";
import { ExportEngineError } from "./errors.js";
import { getExportPreset } from "./exportPresets.js";

describe("renderFinalExport (against the real bundled ffmpeg)", () => {
  let workDir: string;
  let ffmpegPath: string;
  let videoClip: string; // 640x360 red, 3s
  let narrationClip: string; // 3s tone

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"));
    const located = locateFfmpeg();
    if (!located.ffmpegPath) throw new Error("Test setup requires the bundled ffmpeg binary.");
    ffmpegPath = located.ffmpegPath;

    videoClip = path.join(workDir, "video.mp4");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "color=c=red:size=640x360:duration=3:rate=15", videoClip]);

    narrationClip = path.join(workDir, "narration.wav");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", narrationClip]);
  }, 30_000);

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("renders a muxed video+audio file at the requested preset resolution with captions burned in", async () => {
    const output = path.join(workDir, "final.mp4");
    const preset = getExportPreset("youtube-720p")!;

    await renderFinalExport(
      {
        videoSegments: [{ filePath: videoClip, startSeconds: 0, endSeconds: 3 }],
        audioClips: [
          {
            filePath: narrationClip,
            timelineStartSeconds: 0,
            sourceInSeconds: 0,
            durationSeconds: 3,
            volume: 1,
            fadeInSeconds: 0,
            fadeOutSeconds: 0,
          },
        ],
        captions: [{ startSeconds: 0, endSeconds: 2, text: "Hello, world!" }],
        preset,
      },
      output,
    );

    const probe = await probeMedia(output);
    expect(probe.width).toBe(preset.width);
    expect(probe.height).toBe(preset.height);
    expect(probe.durationSeconds).toBeCloseTo(3, 0);
    expect(probe.audioCodec).toBeTruthy();
    expect(probe.videoCodec).toBeTruthy();
  }, 30_000);

  it("still produces a (silent) audio track when there are no audio clips", async () => {
    const output = path.join(workDir, "video-only.mp4");
    const preset = getExportPreset("square-1080x1080")!;

    await renderFinalExport({ videoSegments: [{ filePath: videoClip, startSeconds: 0, endSeconds: 2 }], audioClips: [], preset }, output);

    const probe = await probeMedia(output);
    expect(probe.audioCodec).toBeTruthy();
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1080);
  }, 30_000);

  it("throws a structured error for an empty video segment list", async () => {
    const preset = getExportPreset("youtube-1080p")!;
    await expect(renderFinalExport({ videoSegments: [], audioClips: [], preset }, path.join(workDir, "shouldfail.mp4"))).rejects.toBeInstanceOf(
      ExportEngineError,
    );
  });
});
