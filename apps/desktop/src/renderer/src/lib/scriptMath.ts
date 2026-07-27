import type { Script } from "@aether/shared-types";

export const NARRATION_SPEED_PRESETS = [
  { label: "Slow (115 wpm)", value: 115 },
  { label: "Instructional (130 wpm)", value: 130 },
  { label: "Conversational (145 wpm)", value: 145 },
  { label: "Energetic (160 wpm)", value: 160 },
];

export function countWords(text: string | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[“”"()]/g, " ");
  const matches = cleaned.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function scriptWordCount(script: Script): number {
  return script.segments.reduce((sum, seg) => sum + countWords(seg.narration), 0);
}

export function estimatedDurationSeconds(script: Script): number {
  const words = scriptWordCount(script);
  return Math.round((words / script.narrationSpeedWpm) * 60);
}

export function formatDuration(totalSeconds: number | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
