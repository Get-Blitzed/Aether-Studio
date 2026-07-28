import path from "node:path";

const EXTENSION_GROUPS: Record<string, "image" | "video" | "audio" | "font" | "document" | "other"> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".bmp": "image",
  ".svg": "image",
  ".mp4": "video",
  ".mov": "video",
  ".webm": "video",
  ".mkv": "video",
  ".avi": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".flac": "audio",
  ".ogg": "audio",
  ".ttf": "font",
  ".otf": "font",
  ".woff": "font",
  ".woff2": "font",
  ".pdf": "document",
  ".docx": "document",
  ".pptx": "document",
  ".md": "document",
  ".txt": "document",
};

/** Coarse media kind from file extension -- drives which preview/metadata pipeline applies. */
export function classifyFileKind(filePath: string): "image" | "video" | "audio" | "font" | "document" | "other" {
  return EXTENSION_GROUPS[path.extname(filePath).toLowerCase()] ?? "other";
}
