import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ipcMain, dialog, type BrowserWindow } from "electron";
import { readManifest, saveProject } from "@aether/project-engine";
import { generateId, nowIso, type Logger } from "@aether/core";
import { classifyFileKind, probeMedia } from "@aether/media-engine";
import { extractDocument, buildScriptFromDocument, renderTextSlide, DocumentEngineError } from "@aether/document-engine";
import { imageToVideo } from "@aether/media-engine";
import { SapiVoiceProvider } from "@aether/ai-providers";
import type { Asset, Timeline, TimelineClip, TimelineTrack } from "@aether/shared-types";
import type { SettingsRepository } from "@aether/database";
import type { AppError } from "./projectsIpc.js";
import { buildAssetFromFile } from "../assetBuilder.js";

const WORDS_PER_MINUTE = 130;
const MIN_SLIDE_SECONDS = 3;
const SLIDE_BUFFER_SECONDS = 1.5;
const NARRATION_TAIL_SECONDS = 0.75;

function toAppError(error: unknown): AppError {
  if (error instanceof DocumentEngineError) return { title: "Document import error", detail: error.message, code: error.code };
  if (error instanceof Error) return { title: "Document import error", detail: error.message };
  return { title: "Document import error", detail: String(error) };
}

function estimateSlideSeconds(pageText: string): number {
  const wordCount = pageText.split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_SLIDE_SECONDS, (wordCount / WORDS_PER_MINUTE) * 60 + SLIDE_BUFFER_SECONDS);
}

interface RegisterDeps {
  logger: Logger;
  settingsRepo: SettingsRepository;
  getWindow: () => BrowserWindow | null;
}

export function registerDocumentsIpc({ logger, settingsRepo, getWindow }: RegisterDeps): void {
  ipcMain.handle("documents:choose-file", async (): Promise<string | null> => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      title: "Choose a document or video to convert",
      filters: [
        { name: "Documents", extensions: ["pdf", "docx", "pptx"] },
        { name: "Video", extensions: ["mp4", "mkv", "mov", "webm", "avi"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0]!;
  });

  ipcMain.handle(
    "documents:import-and-convert",
    async (_event, args: { projectDir: string; filePath: string; narrate?: boolean }) => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aether-doc-import-"));
      try {
        const manifest = readManifest(args.projectDir);
        const ffmpegOverridePath = settingsRepo.get().ffmpegPath;
        const kind = classifyFileKind(args.filePath);

        if (kind === "video" || kind === "audio" || kind === "image") {
          const category = kind === "video" ? "videos" : kind === "audio" ? "narration" : "images";
          const asset = await buildAssetFromFile(args.projectDir, args.filePath, category, "managed", ffmpegOverridePath, logger);
          const updatedManifest = { ...manifest, assets: [...manifest.assets, asset] };
          const saved = saveProject(args.projectDir, updatedManifest);
          return { ok: true as const, mode: "asset-import" as const, manifest: saved };
        }

        const documentTitle = path.parse(args.filePath).name;
        const extracted = await extractDocument(args.filePath);
        const { script, storyboardFrames } = buildScriptFromDocument(extracted.pages, documentTitle);

        // Native Windows voices (SAPI) are the narration source -- fully
        // offline, no provider configuration required. If a page fails to
        // synthesize (no voices installed, non-Windows host, etc.) that
        // page silently falls back to a word-count-estimated slide
        // duration with no narration clip, rather than failing the whole
        // import.
        const wantsNarration = args.narrate !== false;
        const voiceProvider = wantsNarration ? new SapiVoiceProvider() : null;

        const generatedAssets: Asset[] = [];
        const clips: TimelineClip[] = [];
        const narrationClips: TimelineClip[] = [];
        let cursorSeconds = 0;
        let narratedPageCount = 0;
        const timestamp = nowIso();

        for (let i = 0; i < extracted.pages.length; i += 1) {
          const pageText = extracted.pages[i]!;
          const slideImagePath = path.join(tempDir, `slide-${i + 1}.png`);
          const slideVideoPath = path.join(tempDir, `slide-${i + 1}.mp4`);

          let durationSeconds = estimateSlideSeconds(pageText);
          let narrationAsset: Asset | null = null;

          if (voiceProvider && pageText.trim()) {
            try {
              const synthResult = await voiceProvider.synthesizeVoice({ text: pageText });
              const probe = await probeMedia(synthResult.filePath, ffmpegOverridePath);
              narrationAsset = await buildAssetFromFile(args.projectDir, synthResult.filePath, "narration", "managed", ffmpegOverridePath, logger);
              fs.rmSync(synthResult.filePath, { force: true });
              durationSeconds = Math.max(MIN_SLIDE_SECONDS, (probe.durationSeconds ?? durationSeconds) + NARRATION_TAIL_SECONDS);
              narratedPageCount += 1;
            } catch (narrationError) {
              logger.warn("Document page narration synthesis failed; falling back to a silent slide", {
                page: i + 1,
                error: narrationError instanceof Error ? narrationError.message : String(narrationError),
              });
            }
          }

          await renderTextSlide(
            {
              title: documentTitle,
              bodyText: pageText,
              pageLabel: `Page ${i + 1} of ${extracted.pages.length}`,
              ffmpegOverridePath,
            },
            slideImagePath,
          );
          await imageToVideo(slideImagePath, slideVideoPath, durationSeconds, ffmpegOverridePath);

          const asset = await buildAssetFromFile(args.projectDir, slideVideoPath, "videos", "managed", ffmpegOverridePath, logger);
          generatedAssets.push(asset);
          if (narrationAsset) generatedAssets.push(narrationAsset);

          clips.push({
            id: generateId("clip"),
            trackId: "track_primary_video",
            assetId: asset.id,
            sourceInSeconds: 0,
            timelineStartSeconds: cursorSeconds,
            timelineDurationSeconds: durationSeconds,
            volume: 1,
            opacity: 1,
            fadeInSeconds: 0,
            fadeOutSeconds: 0,
            muted: false,
            locked: false,
            notes: `Generated from document page ${i + 1}; linked script segment ${script.segments[i]?.id ?? ""}.`,
            createdAt: timestamp,
            modifiedAt: timestamp,
          });

          if (narrationAsset) {
            narrationClips.push({
              id: generateId("clip"),
              trackId: "track_narration",
              assetId: narrationAsset.id,
              sourceInSeconds: 0,
              timelineStartSeconds: cursorSeconds,
              timelineDurationSeconds: narrationAsset.durationSeconds ?? durationSeconds,
              volume: 1,
              opacity: 1,
              fadeInSeconds: 0,
              fadeOutSeconds: 0,
              muted: false,
              locked: false,
              notes: `Native-voice narration for document page ${i + 1}.`,
              createdAt: timestamp,
              modifiedAt: timestamp,
            });
          }

          cursorSeconds += durationSeconds;
        }

        const tracks: TimelineTrack[] = [
          { id: "track_primary_video", type: "primary-video", name: "Primary Video", order: 0, muted: false, solo: false, locked: false },
          { id: "track_narration", type: "narration", name: "Narration", order: 1, muted: false, solo: false, locked: false },
        ];

        const timeline: Timeline = {
          id: generateId("timeline"),
          name: `${documentTitle} (from document)`,
          aspectRatio: "16:9",
          frameRate: 30,
          tracks,
          clips: [...clips, ...narrationClips],
          markers: [],
          createdAt: timestamp,
          modifiedAt: timestamp,
        };

        const updatedManifest = {
          ...manifest,
          scripts: [...manifest.scripts, script],
          storyboardFrames: [...manifest.storyboardFrames, ...storyboardFrames],
          assets: [...manifest.assets, ...generatedAssets],
          timelines: [...manifest.timelines, timeline],
        };
        const saved = saveProject(args.projectDir, updatedManifest);

        return {
          ok: true as const,
          mode: "document-conversion" as const,
          manifest: saved,
          scriptId: script.id,
          timelineId: timeline.id,
          pageCount: extracted.pages.length,
          narratedPageCount,
        };
      } catch (error) {
        logger.error("documents:import-and-convert failed", error);
        return { ok: false as const, error: toAppError(error) };
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  );
}
