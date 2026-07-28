import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { probeMedia } from "@aether/media-engine";
import { renderTextSlide } from "./renderTextSlide.js";

describe("renderTextSlide (against the real bundled ffmpeg)", () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const file of createdFiles.splice(0)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it("renders a real PNG at the requested dimensions", async () => {
    const output = path.join(os.tmpdir(), `aether-slide-test-${Date.now()}.png`);
    createdFiles.push(output);

    await renderTextSlide(
      { title: "Quarterly Report", bodyText: "Revenue grew steadily across every region this quarter.", pageLabel: "Page 1 of 3", width: 1280, height: 720 },
      output,
    );

    expect(fs.existsSync(output)).toBe(true);
    const probe = await probeMedia(output);
    expect(probe.width).toBe(1280);
    expect(probe.height).toBe(720);
  }, 20_000);

  it("handles long body text by wrapping instead of failing", async () => {
    const output = path.join(os.tmpdir(), `aether-slide-test-long-${Date.now()}.png`);
    createdFiles.push(output);

    const longText = "word ".repeat(400).trim();
    await renderTextSlide({ bodyText: longText }, output);

    expect(fs.existsSync(output)).toBe(true);
    expect(fs.statSync(output).size).toBeGreaterThan(0);
  }, 20_000);
});
