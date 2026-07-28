import fs from "node:fs";
import { DocumentEngineError } from "./errors.js";

interface PdfTextItem {
  str: string;
}

/**
 * Extracts text page-by-page from a PDF using `pdfjs-dist` directly (the
 * engine behind most PDF text extraction in the JS ecosystem, actively
 * maintained, zero runtime dependencies of its own). The "legacy" build
 * entry point is used because it targets Node rather than a browser DOM;
 * only `getTextContent()` is called, so no canvas/rendering dependency is
 * ever pulled in -- a deliberate choice after the `pdf-parse` package
 * (which bundles a years-old, no-longer-maintained copy of pdf.js)
 * failed to parse a real pdf-lib-generated PDF in testing.
 */
export async function extractPdfText(filePath: string): Promise<string[]> {
  let getDocument: (options: { data: Uint8Array; useWorkerFetch: boolean; isEvalSupported: boolean }) => { promise: Promise<PdfDocumentProxy> };
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    getDocument = pdfjs.getDocument as unknown as typeof getDocument;
  } catch (cause) {
    throw new DocumentEngineError("pdfjs-dist could not be loaded.", "EXTRACTION_FAILED", cause);
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(fs.readFileSync(filePath));
  } catch (cause) {
    throw new DocumentEngineError(`Could not read PDF file: ${filePath}`, "EXTRACTION_FAILED", cause);
  }

  try {
    const doc = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = (content.items as PdfTextItem[]).map((item) => item.str).join(" ");
      pages.push(text.trim());
    }
    try {
      await doc.destroy?.();
    } catch {
      // Best-effort cleanup only; the text is already extracted.
    }
    return pages.length > 0 ? pages : [""];
  } catch (cause) {
    throw new DocumentEngineError(`Failed to extract text from PDF: ${filePath}`, "EXTRACTION_FAILED", cause);
  }
}

interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
  destroy?(): Promise<void>;
}
