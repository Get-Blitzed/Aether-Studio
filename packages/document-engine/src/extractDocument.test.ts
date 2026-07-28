import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PptxGenJS from "pptxgenjs";
import { extractDocument, detectDocumentSourceType } from "./extractDocument.js";

describe("extractDocument (against real generated fixture files)", () => {
  let workDir: string;
  let pdfPath: string;
  let docxPath: string;
  let pptxPath: string;

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "document-engine-test-"));

    // --- Real PDF fixture (pdf-lib) ---
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page1 = pdfDoc.addPage([612, 792]);
    page1.drawText("Hello from page one of the PDF.", { x: 50, y: 700, size: 18, font });
    const page2 = pdfDoc.addPage([612, 792]);
    page2.drawText("Second page content lives here.", { x: 50, y: 700, size: 18, font });
    pdfPath = path.join(workDir, "fixture.pdf");
    fs.writeFileSync(pdfPath, await pdfDoc.save());

    // --- Real DOCX fixture (docx) ---
    const docxDoc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun("This is the first paragraph of the Word document.")] }),
            new Paragraph({ children: [new TextRun("This is the second paragraph, with different content.")] }),
          ],
        },
      ],
    });
    docxPath = path.join(workDir, "fixture.docx");
    fs.writeFileSync(docxPath, await Packer.toBuffer(docxDoc));

    // --- Real PPTX fixture (pptxgenjs) ---
    const pptx = new PptxGenJS();
    const slide1 = pptx.addSlide();
    slide1.addText("Welcome to slide one", { x: 1, y: 1, w: 8, h: 1 });
    const slide2 = pptx.addSlide();
    slide2.addText("Slide two has different text", { x: 1, y: 1, w: 8, h: 1 });
    pptxPath = path.join(workDir, "fixture.pptx");
    await pptx.writeFile({ fileName: pptxPath });
  }, 30_000);

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("detects source type from extension", () => {
    expect(detectDocumentSourceType("x.pdf")).toBe("pdf");
    expect(detectDocumentSourceType("x.docx")).toBe("docx");
    expect(detectDocumentSourceType("x.pptx")).toBe("pptx");
    expect(detectDocumentSourceType("x.mp4")).toBeUndefined();
  });

  it("extracts real per-page text from a PDF", async () => {
    const result = await extractDocument(pdfPath);
    expect(result.sourceType).toBe("pdf");
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain("Hello from page one");
    expect(result.pages[1]).toContain("Second page content");
  });

  it("extracts real text from a DOCX, grouped into pseudo-pages", async () => {
    const result = await extractDocument(docxPath);
    expect(result.sourceType).toBe("docx");
    const joined = result.pages.join(" ");
    expect(joined).toContain("first paragraph of the Word document");
    expect(joined).toContain("second paragraph, with different content");
  });

  it("extracts real per-slide text from a PPTX", async () => {
    const result = await extractDocument(pptxPath);
    expect(result.sourceType).toBe("pptx");
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain("Welcome to slide one");
    expect(result.pages[1]).toContain("Slide two has different text");
  });

  it("rejects an unsupported file type", async () => {
    await expect(extractDocument(path.join(workDir, "video.mp4"))).rejects.toThrow();
  });
});
