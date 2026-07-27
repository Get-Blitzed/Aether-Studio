import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { runProcess } from "./runProcess.js";
import { probeMedia } from "./probeMedia.js";
import { concatVideoClips } from "./concatVideoClips.js";
import { MediaEngineError } from "./errors.js";

describe("concatVideoClips (against the real bundled ffmpeg)", () => {
  let workDir: string;
  let ffmpegPath: string;
  let clipA: string; // 320x240 red, 2s
  let clipB: string; // 640x480 blue, 3s

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "concat-test-"));
    const located = locateFfmpeg();
    if (!located.ffmpegPath) throw new Error("Test setup requires the bundled ffmpeg binary.");
    ffmpegPath = located.ffmpegPath;

    clipA = path.join(workDir, "a.mp4");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "color=c=red:size=320x240:duration=2:rate=10", clipA]);

    clipB = path.join(workDir, "b.mp4");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "color=c=blue:size=640x480:duration=3:rate=10", clipB]);
  }, 30_000);

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("trims and concatenates differently-sized clips into a common resolution", async () => {
    const output = path.join(workDir, "preview.mp4");
    await concatVideoClips(
      [
        { filePath: clipA, startSeconds: 0, endSeconds: 1 },
        { filePath: clipB, startSeconds: 0, endSeconds: 1.5 },
      ],
      output,
    );
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeCloseTo(2.5, 0);
    expect(probe.width).toBe(1280);
    expect(probe.height).toBe(720);
  });

  it("supports a custom output resolution", async () => {
    const output = path.join(workDir, "preview-small.mp4");
    await concatVideoClips([{ filePath: clipA, startSeconds: 0, endSeconds: 1 }], output, { width: 640, height: 360 });
    const probe = await probeMedia(output);
    expect(probe.width).toBe(640);
    expect(probe.height).toBe(360);
  });

  it("throws a structured error for an empty segment list", async () => {
    await expect(concatVideoClips([], path.join(workDir, "shouldfail.mp4"))).rejects.toBeInstanceOf(MediaEngineError);
  });
});
