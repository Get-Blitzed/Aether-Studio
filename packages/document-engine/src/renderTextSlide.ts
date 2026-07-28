import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { locateFfmpeg, runProcess } from "@aether/media-engine";
import { DocumentEngineError } from "./errors.js";

export interface RenderTextSlideOptions {
  title?: string;
  bodyText: string;
  pageLabel?: string;
  width?: number;
  height?: number;
  ffmpegOverridePath?: string;
}

/** Wraps text to a fixed character width without ever splitting a word. */
function wrapText(text: string, maxCharsPerLine: number): string {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxCharsPerLine && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    if (words.length === 0) lines.push("");
  }
  return lines.join("\n");
}

/**
 * Renders a real PNG "slide card" for one page/slide of an imported
 * document: a branded background with the wrapped body text (and an
 * optional title) burned in via ffmpeg's `drawtext` filter, reading from
 * temp text files (`textfile=`) rather than inlining the text into the
 * filtergraph string -- avoids filtergraph escaping entirely for
 * arbitrary-length document text, the same reasoning behind Phase 7's
 * caption burn-in using per-caption `drawtext` calls.
 */
export async function renderTextSlide(options: RenderTextSlideOptions, outputPath: string): Promise<void> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const { ffmpegPath } = locateFfmpeg(options.ffmpegOverridePath);
  if (!ffmpegPath) {
    throw new DocumentEngineError("ffmpeg is not available; cannot render a document slide.", "FFMPEG_NOT_FOUND");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const maxCharsPerLine = Math.floor(width / 34);
  const bodyLines = wrapText(options.bodyText, maxCharsPerLine).split("\n").slice(0, 14).join("\n");
  const titleText = (options.title ?? "").trim();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-slide-"));
  const bodyFile = path.join(tempDir, "body.txt");
  const titleFile = path.join(tempDir, "title.txt");
  fs.writeFileSync(bodyFile, bodyLines, "utf-8");
  fs.writeFileSync(titleFile, titleText || " ", "utf-8");

  const bodyFontSize = Math.max(20, Math.floor(width / 48));
  const titleFontSize = Math.max(28, Math.floor(width / 28));
  const escapedTitleFile = titleFile.replace(/\\/g, "/").replace(/:/g, "\\:");
  const escapedBodyFile = bodyFile.replace(/\\/g, "/").replace(/:/g, "\\:");

  const filters = [
    `drawtext=textfile='${escapedTitleFile}':fontcolor=0x3E8EF7:fontsize=${titleFontSize}:x=80:y=70:box=0`,
    `drawtext=textfile='${escapedBodyFile}':fontcolor=white:fontsize=${bodyFontSize}:x=80:y=${Math.floor(height * 0.22)}:line_spacing=14`,
  ];
  if (options.pageLabel) {
    filters.push(`drawtext=text='${options.pageLabel.replace(/'/g, "’")}':fontcolor=0x8892A6:fontsize=22:x=w-tw-40:y=h-th-30`);
  }

  try {
    await runProcess(ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x131A2B:size=${width}x${height}`,
      "-vf",
      filters.join(","),
      "-frames:v",
      "1",
      outputPath,
    ]);
  } catch (cause) {
    throw new DocumentEngineError("Failed to render document slide.", "SLIDE_RENDER_FAILED", cause);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
