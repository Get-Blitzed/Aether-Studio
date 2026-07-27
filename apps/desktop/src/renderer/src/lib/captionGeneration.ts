import type { Script, Caption } from "@aether/shared-types";
import { countWords } from "./scriptMath";
import { generateId, nowIso } from "./ids";

/** One caption per scene, timed sequentially from cumulative narration word count at the script's narration speed. */
export function generateCaptionsFromScript(script: Script): Caption[] {
  const timestamp = nowIso();
  let cursor = 0;
  const captions: Caption[] = [];
  for (const segment of script.segments) {
    const words = countWords(segment.narration);
    const durationSeconds = words > 0 ? (words / script.narrationSpeedWpm) * 60 : 2;
    if (segment.narration && segment.narration.trim().length > 0) {
      captions.push({
        id: generateId("caption"),
        scriptSegmentId: segment.id,
        startSeconds: cursor,
        endSeconds: cursor + durationSeconds,
        text: segment.narration,
        isSoundDescription: false,
        createdAt: timestamp,
        modifiedAt: timestamp,
      });
    }
    cursor += durationSeconds;
  }
  return captions;
}

export const MAX_CHARACTERS_PER_LINE = 42;
export const MAX_READING_WPM = 180;

export function captionWarnings(caption: Caption): string[] {
  const warnings: string[] = [];
  const longestLine = Math.max(...caption.text.split("\n").map((l) => l.length));
  if (longestLine > MAX_CHARACTERS_PER_LINE) {
    warnings.push(`Line exceeds ${MAX_CHARACTERS_PER_LINE} characters (${longestLine}).`);
  }
  const durationMinutes = (caption.endSeconds - caption.startSeconds) / 60;
  if (durationMinutes > 0) {
    const wpm = countWords(caption.text) / durationMinutes;
    if (wpm > MAX_READING_WPM) warnings.push(`Reading speed ~${Math.round(wpm)} wpm exceeds ${MAX_READING_WPM} wpm.`);
  }
  if (caption.endSeconds <= caption.startSeconds) warnings.push("End time is not after start time.");
  return warnings;
}

export function findOverlappingCaptionIds(captions: Caption[]): Set<string> {
  const sorted = [...captions].sort((a, b) => a.startSeconds - b.startSeconds);
  const overlapping = new Set<string>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (curr.startSeconds < prev.endSeconds) {
      overlapping.add(prev.id);
      overlapping.add(curr.id);
    }
  }
  return overlapping;
}
