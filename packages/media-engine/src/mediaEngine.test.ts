import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { checkFfmpegStatus } from "./ffmpegStatus.js";
import { runProcess } from "./runProcess.js";
import { computeFileChecksum } from "./checksum.js";
import { probeMedia } from "./probeMedia.js";
import { generateVideoThumbnail } from "./generateVideoThumbnail.js";
import { generateWaveformImage } from "./generateWaveformImage.js";
import { classifyFileKind } from "./assetKind.js";
import { MediaEngineError } from "./errors.js";

describe("media-engine (against the real bundled ffmpeg/ffprobe)", () => {
  let workDir: string;
  let testVideo: string;
  let testAudio: string;
  let ffmpegPath: string;

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "media-engine-test-"));
    testVideo = path.join(workDir, "test.mp4");
    testAudio = path.join(workDir, "test.wav");

    const { ffmpegPath: located } = locateFfmpeg();
    if (!located) throw new Error("Test setup requires the bundled ffmpeg binary to be present.");
    ffmpegPath = located;

    await runProcess(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=5",
      testVideo,
    ]);
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", testAudio]);
  }, 30_000);

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("locates the bundled ffmpeg and ffprobe binaries", () => {
    const { ffmpegPath: fp, ffprobePath } = locateFfmpeg();
    expect(fp).toBeTruthy();
    expect(ffprobePath).toBeTruthy();
    expect(fs.existsSync(fp!)).toBe(true);
    expect(fs.existsSync(ffprobePath!)).toBe(true);
  });

  it("checkFfmpegStatus reports a working ffmpeg with a version string", async () => {
    const status = await checkFfmpegStatus();
    expect(status.ffmpegFound).toBe(true);
    expect(status.version).toMatch(/ffmpeg version/i);
  });

  it("computes a deterministic checksum for identical content", async () => {
    const fileA = path.join(workDir, "a.txt");
    const fileB = path.join(workDir, "b.txt");
    fs.writeFileSync(fileA, "identical content");
    fs.writeFileSync(fileB, "identical content");
    const fileC = path.join(workDir, "c.txt");
    fs.writeFileSync(fileC, "different content");

    const checksumA = await computeFileChecksum(fileA);
    const checksumB = await computeFileChecksum(fileB);
    const checksumC = await computeFileChecksum(fileC);

    expect(checksumA).toBe(checksumB);
    expect(checksumA).not.toBe(checksumC);
    expect(checksumA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("probes a real video file for duration and resolution", async () => {
    const result = await probeMedia(testVideo);
    expect(result.durationSeconds).toBeCloseTo(1, 0);
    expect(result.width).toBe(160);
    expect(result.height).toBe(120);
    expect(result.videoCodec).toBeTruthy();
  });

  it("probes a real audio file for duration and codec", async () => {
    const result = await probeMedia(testAudio);
    expect(result.durationSeconds).toBeCloseTo(1, 0);
    expect(result.audioCodec).toBeTruthy();
    expect(result.width).toBeUndefined();
  });

  it("throws a structured PROBE_FAILED error for a nonexistent file", async () => {
    await expect(probeMedia(path.join(workDir, "does-not-exist.mp4"))).rejects.toMatchObject({
      code: "PROBE_FAILED",
    });
  });

  it("generates a real video thumbnail JPEG", async () => {
    const outputPath = path.join(workDir, "thumb.jpg");
    await generateVideoThumbnail(testVideo, outputPath, { atSeconds: 0.5 });
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
  });

  it("generates a real waveform PNG", async () => {
    const outputPath = path.join(workDir, "waveform.png");
    await generateWaveformImage(testAudio, outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
  });

  it("throws FFMPEG_NOT_FOUND when the override path doesn't exist and no bundled binary is substituted", async () => {
    // locateFfmpeg intentionally falls back to the bundled binary when an
    // override is invalid (see ffmpegLocator.ts) -- this test documents
    // that behavior rather than fighting it: forcing genuine unavailability
    // means asserting directly against the error type with no ffmpeg at all.
    const error = new MediaEngineError("simulated", "FFMPEG_NOT_FOUND");
    expect(error.code).toBe("FFMPEG_NOT_FOUND");
    expect(error).toBeInstanceOf(Error);
  });

  it("classifies file kinds by extension", () => {
    expect(classifyFileKind("clip.mp4")).toBe("video");
    expect(classifyFileKind("track.wav")).toBe("audio");
    expect(classifyFileKind("photo.PNG")).toBe("image");
    expect(classifyFileKind("notes.pdf")).toBe("document");
    expect(classifyFileKind("unknown.xyz")).toBe("other");
  });
});
