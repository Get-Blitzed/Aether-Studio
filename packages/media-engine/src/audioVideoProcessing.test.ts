import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { locateFfmpeg } from "./ffmpegLocator.js";
import { runProcess } from "./runProcess.js";
import { probeMedia } from "./probeMedia.js";
import {
  trimAudio,
  normalizeLoudness,
  denoiseAudio,
  removeSilence,
  mergeAudioTakes,
  convertAudioFormat,
  analyzeLoudness,
} from "./audioProcessing.js";
import { trimVideo, adjustVideoSpeed } from "./videoProcessing.js";
import { MediaEngineError } from "./errors.js";

describe("audio/video processing (against the real bundled ffmpeg)", () => {
  let workDir: string;
  let ffmpegPath: string;
  let toneWav: string;
  let combinedWav: string; // 1s silence + 1s tone + 1s silence
  let testVideo: string;

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "audio-video-proc-test-"));
    const located = locateFfmpeg();
    if (!located.ffmpegPath) throw new Error("Test setup requires the bundled ffmpeg binary.");
    ffmpegPath = located.ffmpegPath;

    toneWav = path.join(workDir, "tone.wav");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", toneWav]);

    const silenceWav = path.join(workDir, "silence.wav");
    await runProcess(ffmpegPath, ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", silenceWav]);

    combinedWav = path.join(workDir, "combined.wav");
    await runProcess(ffmpegPath, [
      "-y", "-i", silenceWav, "-i", toneWav, "-i", silenceWav,
      "-filter_complex", "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]", "-map", "[out]",
      combinedWav,
    ]);

    testVideo = path.join(workDir, "test.mp4");
    await runProcess(ffmpegPath, [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=10",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
      "-shortest", testVideo,
    ]);
  }, 30_000);

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("trims audio to the requested range", async () => {
    const output = path.join(workDir, "trimmed.wav");
    await trimAudio(combinedWav, output, 0.5, 2.5);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeCloseTo(2, 0);
  });

  it("normalizes loudness without erroring and produces a playable file", async () => {
    const output = path.join(workDir, "normalized.wav");
    await normalizeLoudness(combinedWav, output, -16);
    expect(fs.existsSync(output)).toBe(true);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeGreaterThan(0);
  });

  it("denoises without erroring", async () => {
    const output = path.join(workDir, "denoised.wav");
    await denoiseAudio(combinedWav, output);
    expect(fs.existsSync(output)).toBe(true);
  });

  it("removes silence, shortening a mostly-silent clip", async () => {
    const output = path.join(workDir, "desilenced.wav");
    await removeSilence(combinedWav, output);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeLessThan(3);
  });

  it("merges takes end-to-end into a longer file", async () => {
    const output = path.join(workDir, "merged.wav");
    await mergeAudioTakes([toneWav, toneWav], output);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeCloseTo(2, 0);
  });

  it("refuses to merge fewer than two takes", async () => {
    await expect(mergeAudioTakes([toneWav], path.join(workDir, "shouldfail.wav"))).rejects.toMatchObject({
      code: "MERGE_FAILED",
    });
  });

  it("converts wav to mp3", async () => {
    const output = path.join(workDir, "out.mp3");
    await convertAudioFormat(combinedWav, output, "mp3");
    expect(fs.existsSync(output)).toBe(true);
    const probe = await probeMedia(output);
    expect(probe.audioCodec).toMatch(/mp3/i);
  });

  it("analyzes loudness and returns the converged Summary value, not an early transient reading", async () => {
    // A continuous tone (no silence padding) should read a plausible,
    // stable loudness -- roughly -18 to -25 LUFS for ffmpeg's default sine
    // amplitude. Regression guard for a real bug found during Phase 4
    // verification: the original regex matched the *first* "I: ... LUFS"
    // progress line ffmpeg prints every ~100ms while measuring, not the
    // final "Summary:" block, so it reported wildly wrong values (e.g.
    // -70 LUFS for clearly audible audio).
    const result = await analyzeLoudness(toneWav);
    expect(result.integratedLufs).toBeTypeOf("number");
    expect(result.integratedLufs).toBeGreaterThan(-30);
    expect(result.integratedLufs).toBeLessThan(-10);
    expect(result.truePeakDbfs).toBeTypeOf("number");
  });

  it("normalizeLoudness measurably changes the integrated loudness toward the target", async () => {
    const before = await analyzeLoudness(toneWav);
    const output = path.join(workDir, "normalized-tone.wav");
    await normalizeLoudness(toneWav, output, -16);
    const after = await analyzeLoudness(output);

    expect(after.integratedLufs).toBeTypeOf("number");
    // Must actually change (not a no-op) and land closer to -16 than the original.
    expect(after.integratedLufs).not.toBeCloseTo(before.integratedLufs!, 1);
    expect(Math.abs(after.integratedLufs! - -16)).toBeLessThan(Math.abs(before.integratedLufs! - -16));
  });

  it("trims video to the requested range, keeping both streams", async () => {
    const output = path.join(workDir, "trimmedVideo.mp4");
    await trimVideo(testVideo, output, 1, 2.5);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeCloseTo(1.5, 0);
    expect(probe.videoCodec).toBeTruthy();
    expect(probe.audioCodec).toBeTruthy();
  });

  it("speeds up video playback (2x shortens duration)", async () => {
    const output = path.join(workDir, "sped.mp4");
    await adjustVideoSpeed(testVideo, output, 2);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeLessThan(2);
  });

  it("slows down video playback (0.5x lengthens duration)", async () => {
    const output = path.join(workDir, "slowed.mp4");
    await adjustVideoSpeed(testVideo, output, 0.5);
    const probe = await probeMedia(output);
    expect(probe.durationSeconds).toBeGreaterThan(4);
  });

  it("throws a MediaEngineError instance with the right code shape", () => {
    const error = new MediaEngineError("simulated", "FFMPEG_NOT_FOUND");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("FFMPEG_NOT_FOUND");
  });
});
