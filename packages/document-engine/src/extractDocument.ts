import path from "node:path";
import { DocumentEngineError } from "./errors.js";
import { extractPdfText } from "./extractPdfText.js";
import { extractDocxText } from "./extractDocxText.js";
import { extractPptxText } from "./extractPptxText.js";

export type DocumentSourceType = "pdf" | "docx" | "pptx";

export interface ExtractedDocument {
  sourceType: DocumentSourceType;
  /** One entry per page (PDF) or slide (PPTX); DOCX paragraphs are grouped into pseudo-pages. */
  pages: string[];
}

const EXTENSION_MAP: Record<string, DocumentSourceType> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".pptx": "pptx",
};

export function detectDocumentSourceType(filePath: string): DocumentSourceType | undefined {
  return EXTENSION_MAP[path.extname(filePath).toLowerCase()];
}

/** Extracts page/slide text from a PDF, DOCX, or PPTX file. */
export async function extractDocument(filePath: string): Promise<ExtractedDocument> {
  const sourceType = detectDocumentSourceType(filePath);
  if (!sourceType) {
    throw new DocumentEngineError(
      `Unsupported document type: ${path.extname(filePath)}. Supported: .pdf, .docx, .pptx`,
      "UNSUPPORTED_FILE_TYPE",
    );
  }

  switch (sourceType) {
    case "pdf":
      return { sourceType, pages: await extractPdfText(filePath) };
    case "docx":
      return { sourceType, pages: await extractDocxText(filePath) };
    case "pptx":
      return { sourceType, pages: extractPptxText(filePath) };
  }
}
