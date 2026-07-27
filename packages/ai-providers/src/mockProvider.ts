import os from "node:os";
import path from "node:path";
import { locateFfmpeg, runProcess } from "@aether/media-engine";
import { parseStructuredPrompt } from "./promptTemplates.js";
import { AiProviderError } from "./errors.js";
import type {
  AiProvider,
  ConnectionTestResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  JobUsageEstimate,
  TextGenerationRequest,
  TextGenerationResult,
} from "./types.js";

const OUTLINE_ROLE_TEMPLATES: Record<string, (title: string) => string> = {
  Hook: (title) => `Open with a relatable moment of frustration that "${title}" is about to solve.`,
  Problem: (title) => `Name the specific problem viewers face before discovering "${title}".`,
  Walkthrough: (title) => `Demonstrate the core steps of "${title}" on screen, one action at a time.`,
  Payoff: (title) => `Show viewers the result they get once they've applied "${title}".`,
  "Call to Action": (title) => `Tell viewers exactly what to do next after watching "${title}".`,
  Recap: (title) => `Summarize the single most important takeaway from "${title}".`,
  "Q&A": (title) => `Answer the most common question viewers ask about "${title}".`,
  "Next Steps": (title) => `Point viewers toward what comes after "${title}".`,
};
const OUTLINE_ROLE_ORDER = Object.keys(OUTLINE_ROLE_TEMPLATES);

const HOOK_REWRITE_TEMPLATES: Array<(s: string) => string> = [
  (s) => `Ever wondered ${lowerFirst(stripTrailingPunctuation(s))}? Here's what's really going on.`,
  (s) => `Here's the one thing most people miss: ${lowerFirst(stripTrailingPunctuation(s))}.`,
  (s) => `Stop scrolling -- ${lowerFirst(stripTrailingPunctuation(s))}, and it changes everything.`,
  (s) => `What if ${lowerFirst(stripTrailingPunctuation(s))}? Stick around and find out.`,
];

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s[0]!.toLowerCase() + s.slice(1);
}

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[.!?]+$/, "");
}

function buildOutline(fields: Record<string, string>): string {
  const title = fields.title?.trim() || "Untitled Production";
  const requestedCount = Number.parseInt(fields.scene_count ?? "", 10);
  const sceneCount = Number.isFinite(requestedCount) ? Math.max(1, Math.min(20, requestedCount)) : 5;
  const lines: string[] = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const role = OUTLINE_ROLE_ORDER[i % OUTLINE_ROLE_ORDER.length]!;
    const narration = OUTLINE_ROLE_TEMPLATES[role]!(title);
    lines.push(`${role} | ${narration}`);
  }
  return lines.join("\n");
}

function improveHook(fields: Record<string, string>): string {
  const current = (fields.current ?? "").trim();
  if (!current) return "Provide a CURRENT line to rewrite.";
  const template = HOOK_REWRITE_TEMPLATES[simpleHash(current) % HOOK_REWRITE_TEMPLATES.length]!;
  return template(current);
}

function genericEcho(prompt: string): string {
  return `Mock provider has no template for this request. Configure an OpenAI-compatible or generic REST provider for real generation. Received prompt (${prompt.length} chars).`;
}

function estimateTextUsage(prompt: string, completion: string): JobUsageEstimate {
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(completion.length / 4);
  return { promptTokens, completionTokens, estimatedCostUsd: 0 };
}

function colorForPrompt(prompt: string): string {
  const hash = simpleHash(prompt || "aether-studio-suite");
  const r = (hash >>> 16) & 0xff;
  const g = (hash >>> 8) & 0xff;
  const b = hash & 0xff;
  return `0x${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}...`;
}

/**
 * A fully offline, deterministic provider: no network, no credentials.
 * `generateText` runs simple template-based transforms (not a real
 * language model) against the app's own structured prompt format --
 * genuinely useful for exercising AI-assist buttons without a provider
 * account, but clearly not production-quality generation. `generateImage`
 * renders an actual PNG via ffmpeg (a solid color derived from a hash of
 * the prompt, with the prompt text burned in and a "MOCK GENERATED IMAGE"
 * label) so nobody mistakes it for real AI art.
 */
export class MockProvider implements AiProvider {
  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, message: "Mock provider is always available -- no network or credentials required." };
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const { task, fields } = parseStructuredPrompt(request.prompt);
    let text: string;
    if (task === "outline") text = buildOutline(fields);
    else if (task === "improve-hook") text = improveHook(fields);
    else text = genericEcho(request.prompt);
    return { text, usage: estimateTextUsage(request.prompt, text) };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const width = request.width ?? 1024;
    const height = request.height ?? 576;
    const { ffmpegPath } = locateFfmpeg();
    if (!ffmpegPath) {
      throw new AiProviderError(
        "ffmpeg is not available; the mock image provider needs it to render a placeholder image.",
        "IMAGE_GENERATION_FAILED",
      );
    }

    const outputPath = path.join(os.tmpdir(), `aether-mock-image-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    const color = colorForPrompt(request.prompt);
    const label = truncate(request.prompt, 60).replace(/['\\:]/g, "");
    const fontFile = process.platform === "win32" ? "C:/Windows/Fonts/arial.ttf" : "/System/Library/Fonts/Supplemental/Arial.ttf";
    const drawtext = `drawtext=text='MOCK GENERATED IMAGE\\n${label}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2:fontfile='${fontFile}'`;

    try {
      await runProcess(ffmpegPath, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:size=${width}x${height}`,
        "-vf",
        drawtext,
        "-frames:v",
        "1",
        outputPath,
      ]);
    } catch {
      // drawtext needs a locatable font file; fall back to a plain color
      // card (still a real, deterministic per-prompt image) if that fails.
      await runProcess(ffmpegPath, [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=${color}:size=${width}x${height}`,
        "-frames:v",
        "1",
        outputPath,
      ]);
    }

    return { filePath: outputPath, width, height, usage: { promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 } };
  }
}
