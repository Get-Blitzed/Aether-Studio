import { DocumentEngineError } from "./errors.js";
import { chunkParagraphsIntoPages } from "./chunkText.js";

/**
 * Extracts text from a .docx via `mammoth` (pure JS, no native deps).
 * DOCX has no native "page" concept in its XML (pagination is a rendering
 * concern, not a document-structure one), so paragraphs are grouped into
 * pseudo-pages by word count -- see `chunkParagraphsIntoPages`.
 */
export async function extractDocxText(filePath: string): Promise<string[]> {
  let mammoth: { extractRawText: (input: { path: string }) => Promise<{ value: string }> };
  try {
    mammoth = (await import("mammoth")) as unknown as typeof mammoth;
  } catch (cause) {
    throw new DocumentEngineError("mammoth could not be loaded.", "EXTRACTION_FAILED", cause);
  }

  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const paragraphs = result.value
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return chunkParagraphsIntoPages(paragraphs);
  } catch (cause) {
    throw new DocumentEngineError(`Failed to extract text from DOCX: ${filePath}`, "EXTRACTION_FAILED", cause);
  }
}
