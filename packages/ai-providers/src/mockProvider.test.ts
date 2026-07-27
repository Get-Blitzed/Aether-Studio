import fs from "node:fs";
import { describe, expect, it, afterEach } from "vitest";
import { MockProvider } from "./mockProvider.js";
import { buildStructuredPrompt } from "./promptTemplates.js";

describe("MockProvider.testConnection", () => {
  it("is always ok (no network, no credentials)", async () => {
    const result = await new MockProvider().testConnection();
    expect(result.ok).toBe(true);
  });
});

describe("MockProvider.generateText -- outline", () => {
  it("produces one line per requested scene, cycling through role templates", async () => {
    const provider = new MockProvider();
    const prompt = buildStructuredPrompt("outline", { title: "Mission 001", scene_count: 3 });
    const result = await provider.generateText!({ prompt });
    const lines = result.text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Hook");
    expect(lines[0]).toContain("Mission 001");
  });

  it("is deterministic for the same input", async () => {
    const provider = new MockProvider();
    const prompt = buildStructuredPrompt("outline", { title: "Mission 001", scene_count: 4 });
    const a = await provider.generateText!({ prompt });
    const b = await provider.generateText!({ prompt });
    expect(a.text).toBe(b.text);
  });

  it("clamps scene count to a sane range", async () => {
    const provider = new MockProvider();
    const prompt = buildStructuredPrompt("outline", { title: "X", scene_count: 999 });
    const result = await provider.generateText!({ prompt });
    expect(result.text.split("\n")).toHaveLength(20);
  });
});

describe("MockProvider.generateText -- improve-hook", () => {
  it("rewrites the current line into something different", async () => {
    const provider = new MockProvider();
    const prompt = buildStructuredPrompt("improve-hook", { current: "Welcome to A.I. Blitz." });
    const result = await provider.generateText!({ prompt });
    expect(result.text).not.toBe("Welcome to A.I. Blitz.");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same input", async () => {
    const provider = new MockProvider();
    const prompt = buildStructuredPrompt("improve-hook", { current: "Same line every time" });
    const a = await provider.generateText!({ prompt });
    const b = await provider.generateText!({ prompt });
    expect(a.text).toBe(b.text);
  });
});

describe("MockProvider.generateImage (against the real bundled ffmpeg)", () => {
  const createdFiles: string[] = [];

  afterEach(() => {
    for (const file of createdFiles.splice(0)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it("renders a real PNG file sized as requested", async () => {
    const provider = new MockProvider();
    const result = await provider.generateImage!({ prompt: "a friendly robot presenter", width: 320, height: 180 });
    createdFiles.push(result.filePath);
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(fs.statSync(result.filePath).size).toBeGreaterThan(0);
    expect(result.width).toBe(320);
    expect(result.height).toBe(180);
  }, 20_000);

  it("produces the same color for the same prompt (deterministic)", async () => {
    const provider = new MockProvider();
    const a = await provider.generateImage!({ prompt: "same prompt", width: 64, height: 64 });
    const b = await provider.generateImage!({ prompt: "same prompt", width: 64, height: 64 });
    createdFiles.push(a.filePath, b.filePath);
    const bytesA = fs.readFileSync(a.filePath);
    const bytesB = fs.readFileSync(b.filePath);
    expect(bytesA.equals(bytesB)).toBe(true);
  }, 20_000);
});
