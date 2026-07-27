import fs from "node:fs";
import { ipcMain, dialog, type BrowserWindow } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import { nowIso, generateId, type Logger } from "@aether/core";
import type { Caption } from "@aether/shared-types";
import type { AppError } from "./projectsIpc.js";

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return { title: "Caption error", detail: error.message };
  return { title: "Caption error", detail: String(error) };
}

function formatTimestampSrt(totalSeconds: number): string {
  const ms = Math.round(totalSeconds * 1000);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function formatTimestampVtt(totalSeconds: number): string {
  return formatTimestampSrt(totalSeconds).replace(",", ".");
}

function parseTimestamp(text: string): number {
  const match = /(\d+):(\d{2}):(\d{2})[,.](\d{3})/.exec(text);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function toSrt(captions: Caption[]): string {
  return captions
    .map((c, i) => {
      const speaker = c.speakerLabel ? `${c.speakerLabel}: ` : "";
      return `${i + 1}\n${formatTimestampSrt(c.startSeconds)} --> ${formatTimestampSrt(c.endSeconds)}\n${speaker}${c.text}\n`;
    })
    .join("\n");
}

function toVtt(captions: Caption[]): string {
  const body = captions
    .map((c) => {
      const speaker = c.speakerLabel ? `${c.speakerLabel}: ` : "";
      return `${formatTimestampVtt(c.startSeconds)} --> ${formatTimestampVtt(c.endSeconds)}\n${speaker}${c.text}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** Parses SRT or VTT (both use the same block shape: optional index/header line, a timestamp line, then text lines). */
function parseSubtitleFile(content: string): Array<{ startSeconds: number; endSeconds: number; text: string }> {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\n+/);
  const results: Array<{ startSeconds: number; endSeconds: number; text: string }> = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim().length > 0 && l.trim() !== "WEBVTT");
    const timeLineIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIndex === -1) continue;
    const [startText, endText] = lines[timeLineIndex]!.split("-->");
    const text = lines
      .slice(timeLineIndex + 1)
      .join("\n")
      .trim();
    if (!text) continue;
    results.push({
      startSeconds: parseTimestamp(startText ?? "0"),
      endSeconds: parseTimestamp(endText ?? "0"),
      text,
    });
  }
  return results;
}

interface RegisterDeps {
  logger: Logger;
  getWindow: () => BrowserWindow | null;
}

export function registerCaptionsIpc({ logger, getWindow }: RegisterDeps): void {
  ipcMain.handle("captions:export", async (_event, args: { projectDir: string; format: "srt" | "vtt" }) => {
    const win = getWindow();
    if (!win) return { ok: false as const, error: { title: "No window", detail: "Application window unavailable." } };
    try {
      const manifest = readManifest(args.projectDir);
      const captions = [...manifest.captions].sort((a, b) => a.startSeconds - b.startSeconds);
      const content = args.format === "srt" ? toSrt(captions) : toVtt(captions);

      const result = await dialog.showSaveDialog(win, {
        title: `Export captions as ${args.format.toUpperCase()}`,
        defaultPath: `${manifest.title}.${args.format}`,
        filters: [{ name: args.format.toUpperCase(), extensions: [args.format] }],
      });
      if (result.canceled || !result.filePath) return { ok: false as const, canceled: true as const };

      fs.writeFileSync(result.filePath, content, "utf-8");
      return { ok: true as const, exportedPath: result.filePath };
    } catch (error) {
      logger.error("captions:export failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });

  ipcMain.handle("captions:import", async (_event, projectDir: string) => {
    const win = getWindow();
    if (!win) return { ok: false as const, error: { title: "No window", detail: "Application window unavailable." } };
    try {
      const result = await dialog.showOpenDialog(win, {
        title: "Import captions (SRT or VTT)",
        properties: ["openFile"],
        filters: [{ name: "Subtitles", extensions: ["srt", "vtt"] }],
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: false as const, canceled: true as const };

      const content = fs.readFileSync(result.filePaths[0]!, "utf-8");
      const parsed = parseSubtitleFile(content);
      const timestamp = nowIso();
      const imported: Caption[] = parsed.map((p) => ({
        id: generateId("caption"),
        startSeconds: p.startSeconds,
        endSeconds: p.endSeconds,
        text: p.text,
        isSoundDescription: false,
        createdAt: timestamp,
        modifiedAt: timestamp,
      }));

      const manifest = readManifest(projectDir);
      const updatedManifest = { ...manifest, captions: [...manifest.captions, ...imported] };
      const saved = saveProject(projectDir, updatedManifest);
      return { ok: true as const, manifest: saved, imported: imported.length };
    } catch (error) {
      logger.error("captions:import failed", error);
      return { ok: false as const, error: toAppError(error) };
    }
  });
}
