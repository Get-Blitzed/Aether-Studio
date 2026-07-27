import fs from "node:fs";
import path from "node:path";
import { nowIso, sanitizeFileName, type Logger } from "@aether/core";
import {
  computeFileChecksum,
  probeMedia,
  generateVideoThumbnail,
  generateWaveformImage,
  classifyFileKind,
  MediaEngineError,
} from "@aether/media-engine";
import type { Asset, AssetCategory } from "@aether/shared-types";

export function assetsDirFor(projectDir: string): string {
  return path.join(projectDir, "assets");
}

export function previewsDirFor(projectDir: string): string {
  return path.join(projectDir, "cache", "previews");
}

/** Resolves an asset's stored path (relative when managed, absolute when linked) to a real absolute path. */
export function resolveAssetPath(projectDir: string, asset: Pick<Asset, "storageMode" | "filePath">): string {
  return asset.storageMode === "managed" ? path.join(projectDir, asset.filePath) : asset.filePath;
}

// Windows paths may contain characters path.parse handles fine, but keep a
// single seam here in case future storage-path shapes need normalizing.
function destNameSafe(storedPath: string): string {
  return path.basename(storedPath);
}

/**
 * Builds a full Asset record from a source file: computes its checksum,
 * copies it into the project (managed) or leaves it in place (linked),
 * probes and generates preview media best-effort. Shared by the Asset
 * Library's import flow and Screen Capture Studio's "save recording as an
 * asset" flow -- both produce the same kind of library entry.
 */
export async function buildAssetFromFile(
  projectDir: string,
  sourcePath: string,
  category: AssetCategory,
  storageMode: "managed" | "linked",
  ffmpegOverridePath: string | undefined,
  logger: Logger,
): Promise<Asset> {
  const timestamp = nowIso();
  const originalFileName = path.basename(sourcePath);
  const checksumSha256 = await computeFileChecksum(sourcePath);

  let storedRelativeOrAbsolutePath: string;
  if (storageMode === "managed") {
    const destDir = path.join(assetsDirFor(projectDir), category);
    fs.mkdirSync(destDir, { recursive: true });
    const safeName = sanitizeFileName(path.parse(originalFileName).name, "asset") + path.extname(originalFileName);
    let destName = safeName;
    let counter = 1;
    while (fs.existsSync(path.join(destDir, destName))) {
      destName = `${path.parse(safeName).name}-${counter}${path.extname(safeName)}`;
      counter += 1;
    }
    fs.copyFileSync(sourcePath, path.join(destDir, destName));
    storedRelativeOrAbsolutePath = path.join("assets", category, destName);
  } else {
    storedRelativeOrAbsolutePath = sourcePath;
  }

  const absolutePath =
    storageMode === "managed" ? path.join(projectDir, storedRelativeOrAbsolutePath) : storedRelativeOrAbsolutePath;

  const kind = classifyFileKind(originalFileName);
  let durationSeconds: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let thumbnailPath: string | undefined;
  let waveformImagePath: string | undefined;

  if (kind === "video" || kind === "audio") {
    try {
      const probe = await probeMedia(absolutePath, ffmpegOverridePath);
      durationSeconds = probe.durationSeconds;
      width = probe.width;
      height = probe.height;
    } catch (error) {
      logger.warn("Media probe failed; continuing without duration/resolution metadata", {
        file: absolutePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (kind === "video") {
    const previewsDir = previewsDirFor(projectDir);
    const outputPath = path.join(previewsDir, `${path.parse(destNameSafe(storedRelativeOrAbsolutePath)).name}.jpg`);
    try {
      await generateVideoThumbnail(absolutePath, outputPath, { ffmpegOverridePath });
      thumbnailPath = path.relative(projectDir, outputPath);
    } catch (error) {
      logger.warn("Video thumbnail generation failed; asset will show a generic icon instead", {
        file: absolutePath,
        error: error instanceof MediaEngineError ? error.code : String(error),
      });
    }
  } else if (kind === "audio") {
    const previewsDir = previewsDirFor(projectDir);
    const outputPath = path.join(previewsDir, `${path.parse(destNameSafe(storedRelativeOrAbsolutePath)).name}.png`);
    try {
      await generateWaveformImage(absolutePath, outputPath, { ffmpegOverridePath });
      waveformImagePath = path.relative(projectDir, outputPath);
    } catch (error) {
      logger.warn("Waveform generation failed; asset will show without a waveform preview", {
        file: absolutePath,
        error: error instanceof MediaEngineError ? error.code : String(error),
      });
    }
  }

  let fileSizeBytes: number | undefined;
  try {
    fileSizeBytes = fs.statSync(absolutePath).size;
  } catch {
    fileSizeBytes = undefined;
  }

  return {
    id: `asset_${checksumSha256.slice(0, 12)}_${Date.now()}`,
    category,
    storageMode,
    filePath: storedRelativeOrAbsolutePath,
    originalFileName,
    fileSizeBytes,
    checksumSha256,
    durationSeconds,
    width,
    height,
    thumbnailPath,
    waveformImagePath,
    tags: [],
    collections: [],
    isFavorite: false,
    usageCount: 0,
    importedAt: timestamp,
    modifiedAt: timestamp,
  };
}
