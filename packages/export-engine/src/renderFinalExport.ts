import fs from "node:fs";
import path from "node:path";
import { locateFfmpeg, runProcess } from "@aether/media-engine";
import { ExportEngineError } from "./errors.js";
import type { ExportPreset } from "./exportPresets.js";

export interface ExportVideoSegment {
  filePath: string;
  startSeconds: number;
  endSeconds: number;
}

export interface ExportAudioClip {
  filePath: string;
  timelineStartSeconds: number;
  sourceInSeconds: number;
  durationSeconds: number;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

export interface ExportCaption {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface ExportBlurRegion {
  startSeconds: number;
  endSeconds: number;
  /** All in 0-100, percentage of the export frame -- resolution-independent. */
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  blurStrength: number;
}

export interface RenderFinalExportOptions {
  videoSegments: ExportVideoSegment[];
  audioClips: ExportAudioClip[];
  captions?: ExportCaption[];
  blurRegions?: ExportBlurRegion[];
  preset: ExportPreset;
  ffmpegOverridePath?: string;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/\r?\n/g, " ");
}

function totalVideoDuration(segments: ExportVideoSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.endSeconds - s.startSeconds), 0);
}

/**
 * Renders a project's timeline into a real delivery video: the primary
 * video track (trimmed/scaled/padded/concatenated, same approach as Phase
 * 5's quick preview), every narration/music/sound-effect clip positioned
 * at its timeline start and mixed into one audio stream, and captions
 * burned in via a chain of time-windowed drawtext filters. This is a step
 * up from Phase 5's `concatVideoClips()` (video-only, no captions) -- see
 * KNOWN_LIMITATIONS.md for what's still out of scope (overlay/graphics/title
 * track compositing, secondary video/character-animation/screen-capture
 * tracks).
 */
export async function renderFinalExport(options: RenderFinalExportOptions, outputPath: string): Promise<void> {
  const { videoSegments, audioClips, captions = [], blurRegions = [], preset } = options;
  if (videoSegments.length === 0) {
    throw new ExportEngineError("At least one primary-video clip is required to export.", "NO_VIDEO_SEGMENTS");
  }

  const { ffmpegPath } = locateFfmpeg(options.ffmpegOverridePath);
  if (!ffmpegPath) {
    throw new ExportEngineError("ffmpeg is not available; cannot export.", "FFMPEG_NOT_FOUND");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const { width, height, frameRate } = preset;
  const inputArgs: string[] = [];
  const filters: string[] = [];
  let inputIndex = 0;

  const videoLabels: string[] = [];
  for (const seg of videoSegments) {
    inputArgs.push("-i", seg.filePath);
    const idx = inputIndex++;
    const label = `v${idx}`;
    filters.push(
      `[${idx}:v]trim=start=${seg.startSeconds}:end=${seg.endSeconds},setpts=PTS-STARTPTS,` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${frameRate}[${label}]`,
    );
    videoLabels.push(`[${label}]`);
  }
  filters.push(`${videoLabels.join("")}concat=n=${videoSegments.length}:v=1:a=0[vconcat]`);

  let videoOutLabel = "vconcat";
  captions.forEach((caption, i) => {
    const nextLabel = `vcap${i}`;
    const text = escapeDrawtext(caption.text);
    filters.push(
      `[${videoOutLabel}]drawtext=text='${text}':fontcolor=white:fontsize=${Math.max(18, Math.round(height / 20))}:` +
        `box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=h-text_h-${Math.round(height * 0.06)}:` +
        `enable='between(t\\,${caption.startSeconds}\\,${caption.endSeconds})'[${nextLabel}]`,
    );
    videoOutLabel = nextLabel;
  });

  // Redaction: each blur region is composited as split -> crop the region
  // -> boxblur it -> overlay it back over the original frame at the same
  // position, gated to its own time window via `enable`. Chaining regions
  // this way (rather than one combined filter) keeps each region
  // independent and lets them overlap in time without interfering.
  blurRegions.forEach((region, i) => {
    const x = Math.max(0, Math.min(width - 2, Math.round((region.xPercent / 100) * width)));
    const y = Math.max(0, Math.min(height - 2, Math.round((region.yPercent / 100) * height)));
    const w = Math.max(2, Math.min(width - x, Math.round((region.widthPercent / 100) * width)));
    const h = Math.max(2, Math.min(height - y, Math.round((region.heightPercent / 100) * height)));
    const baseLabel = `vblurbase${i}`;
    const cropSrcLabel = `vblursrc${i}`;
    const blurredLabel = `vblurred${i}`;
    const nextLabel = `vblur${i}`;
    filters.push(`[${videoOutLabel}]split=2[${baseLabel}][${cropSrcLabel}]`);
    filters.push(`[${cropSrcLabel}]crop=${w}:${h}:${x}:${y},boxblur=${Math.round(region.blurStrength)}:1[${blurredLabel}]`);
    filters.push(
      `[${baseLabel}][${blurredLabel}]overlay=${x}:${y}:enable='between(t\\,${region.startSeconds}\\,${region.endSeconds})'[${nextLabel}]`,
    );
    videoOutLabel = nextLabel;
  });

  const totalDuration = totalVideoDuration(videoSegments);

  if (audioClips.length === 0) {
    inputArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    const idx = inputIndex++;
    filters.push(`[${idx}:a]atrim=duration=${totalDuration}[aout]`);
  } else {
    const audioLabels: string[] = [];
    audioClips.forEach((clip, i) => {
      inputArgs.push("-i", clip.filePath);
      const idx = inputIndex++;
      const label = `a${i}`;
      const fadeOutStart = Math.max(0, clip.durationSeconds - clip.fadeOutSeconds);
      const delayMs = Math.max(0, Math.round(clip.timelineStartSeconds * 1000));
      filters.push(
        `[${idx}:a]atrim=start=${clip.sourceInSeconds}:duration=${clip.durationSeconds},asetpts=PTS-STARTPTS,` +
          `volume=${clip.volume},afade=t=in:d=${clip.fadeInSeconds},afade=t=out:st=${fadeOutStart}:d=${clip.fadeOutSeconds},` +
          `adelay=${delayMs}:all=1[${label}]`,
      );
      audioLabels.push(`[${label}]`);
    });
    filters.push(`${audioLabels.join("")}amix=inputs=${audioClips.length}:duration=first:dropout_transition=0[aout]`);
  }

  const filterComplex = filters.join(";");

  try {
    await runProcess(
      ffmpegPath,
      [
        "-y",
        ...inputArgs,
        "-filter_complex",
        filterComplex,
        "-map",
        `[${videoOutLabel}]`,
        "-map",
        "[aout]",
        "-t",
        String(totalDuration),
        "-r",
        String(frameRate),
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        outputPath,
      ],
      300_000,
    );
  } catch (cause) {
    throw new ExportEngineError("Failed to render the final export.", "RENDER_FAILED", cause);
  }
}
