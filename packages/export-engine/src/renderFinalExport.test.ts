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

  it("blurs the requested region only, only within its time window", async () => {
    const preset = getExportPreset("youtube-720p")!;

    // testsrc has real high-frequency detail (gradient bars, moving box).
    // A boxblur measurably reduces horizontal pixel-to-pixel variation
    // (total variation) within the blurred region -- PNG file size turned
    // out to be an unreliable proxy here, since re-encoding a blurred
    // region through h264 can introduce its own compression artifacts that
    // sometimes *increase* PNG size despite the image looking smoother.
    // Measuring raw grayscale pixel differences avoids that confound.
    const detailedClip = path.join(workDir, "detailed.mp4");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "testsrc=size=640x360:duration=3:rate=15", detailedClip]);

    const unblurred = path.join(workDir, "unblurred.mp4");
    await renderFinalExport(
      { videoSegments: [{ filePath: detailedClip, startSeconds: 0, endSeconds: 3 }], audioClips: [], preset },
      unblurred,
    );

    const blurred = path.join(workDir, "blurred.mp4");
    await renderFinalExport(
      {
        videoSegments: [{ filePath: detailedClip, startSeconds: 0, endSeconds: 3 }],
        audioClips: [],
        blurRegions: [{ startSeconds: 0, endSeconds: 1.5, xPercent: 20, yPercent: 20, widthPercent: 30, heightPercent: 30, blurStrength: 25 }],
        preset,
      },
      blurred,
    );

    const regionWidth = Math.round(preset.width * 0.3);
    const regionHeight = Math.round(preset.height * 0.3);
    const regionX = Math.round(preset.width * 0.2);
    const regionY = Math.round(preset.height * 0.2);
    const cropFilter = `crop=${regionWidth}:${regionHeight}:${regionX}:${regionY},format=gray`;

    function totalVariation(pgmPath: string): number {
      const buf = fs.readFileSync(pgmPath);
      let idx = 0;
      const readToken = (): string => {
        while (buf[idx] === 0x20 || buf[idx] === 0x0a || buf[idx] === 0x09) idx++;
        const start = idx;
        while (buf[idx] !== 0x20 && buf[idx] !== 0x0a && buf[idx] !== 0x09) idx++;
        return buf.toString("ascii", start, idx);
      };
      readToken(); // magic ("P5")
      const w = Number.parseInt(readToken(), 10);
      const h = Number.parseInt(readToken(), 10);
      readToken(); // maxval
      idx += 1; // single whitespace separator before pixel data
      const pixels = buf.subarray(idx, idx + w * h);
      let tv = 0;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w - 1; x += 1) {
          tv += Math.abs(pixels[y * w + x]! - pixels[y * w + x + 1]!);
        }
      }
      return tv;
    }

    async function extractRegionVariation(source: string, atSeconds: number, outPgm: string): Promise<number> {
      await runProcess(ffmpegPath, ["-y", "-ss", String(atSeconds), "-i", source, "-vf", cropFilter, "-frames:v", "1", "-pix_fmt", "gray", outPgm]);
      return totalVariation(outPgm);
    }

    const unblurredVariation = await extractRegionVariation(unblurred, 0.5, path.join(workDir, "unblurred-region.pgm"));
    const blurredVariation = await extractRegionVariation(blurred, 0.5, path.join(workDir, "blurred-region.pgm"));
    expect(blurredVariation).toBeLessThan(unblurredVariation * 0.75);

    // Outside the blur's time window (region only runs 0-1.5s), the same
    // crop should look like the unblurred source again.
    const laterUnblurredVariation = await extractRegionVariation(unblurred, 2.5, path.join(workDir, "later-unblurred.pgm"));
    const laterBlurredVariation = await extractRegionVariation(blurred, 2.5, path.join(workDir, "later-blurred.pgm"));
    expect(laterBlurredVariation).toBeGreaterThan(laterUnblurredVariation * 0.9);
  }, 60_000);

  it("throws a structured error for an empty video segment list", async () => {
    const preset = getExportPreset("youtube-1080p")!;
    await expect(renderFinalExport({ videoSegments: [], audioClips: [], preset }, path.join(workDir, "shouldfail.mp4"))).rejects.toBeInstanceOf(
      ExportEngineError,
    );
  });
});
