const WORDS_PER_PAGE = 60;

function wordCount(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Groups paragraphs into pseudo-"pages" of roughly `WORDS_PER_PAGE` words
 * each, without ever splitting a paragraph in half -- used for document
 * types (DOCX) that have no native page boundary in their file format.
 */
export function chunkParagraphsIntoPages(paragraphs: string[]): string[] {
  if (paragraphs.length === 0) return [""];
  const pages: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const paragraph of paragraphs) {
    const words = wordCount(paragraph);
    if (currentWords > 0 && currentWords + words > WORDS_PER_PAGE) {
      pages.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
    current.push(paragraph);
    currentWords += words;
  }
  if (current.length > 0) pages.push(current.join("\n\n"));
  return pages;
}
