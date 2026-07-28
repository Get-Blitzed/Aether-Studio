import AdmZip from "adm-zip";
import { DocumentEngineError } from "./errors.js";

const TEXT_RUN_PATTERN = /<a:t>([^<]*)<\/a:t>/g;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extracts text slide-by-slide from a .pptx by reading its slide XML
 * directly (a .pptx is a zip of XML parts) rather than pulling in a full
 * OOXML parsing library -- `ppt/slides/slideN.xml` files each hold their
 * slide's text inside `<a:t>` runs, which is all this needs.
 */
export function extractPptxText(filePath: string): string[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
  } catch (cause) {
    throw new DocumentEngineError(`Could not open PPTX as a zip archive: ${filePath}`, "EXTRACTION_FAILED", cause);
  }

  const slideEntries = zip
    .getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const numA = Number.parseInt(/slide(\d+)\.xml$/.exec(a.entryName)![1]!, 10);
      const numB = Number.parseInt(/slide(\d+)\.xml$/.exec(b.entryName)![1]!, 10);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    throw new DocumentEngineError(`No slides found in PPTX: ${filePath}`, "EXTRACTION_FAILED");
  }

  return slideEntries.map((entry) => {
    const xml = entry.getData().toString("utf-8");
    const runs: string[] = [];
    let match: RegExpExecArray | null;
    TEXT_RUN_PATTERN.lastIndex = 0;
    while ((match = TEXT_RUN_PATTERN.exec(xml)) !== null) {
      const text = decodeXmlEntities(match[1] ?? "").trim();
      if (text.length > 0) runs.push(text);
    }
    return runs.join("\n");
  });
}
