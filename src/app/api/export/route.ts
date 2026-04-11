import { NextResponse } from "next/server";
import type { EditorDocument } from "@/types/schema";
import type { FoldFormat } from "@/imposition/types";
import { elementToHTML } from "@/utils/elementToCSS";
import { renderHtmlToSinglePagePdf, launchBrowser } from "@/imposition/puppeteer";
import { generateImposedPDF } from "@/imposition/impose";
import { SEASON_COLORS, BASE_COLORS } from "@/core/design-system/tokens/colors";

const PREVIEW_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');`;

function themeCss(season: string): string {
  const c = SEASON_COLORS[season] ?? SEASON_COLORS["ordinary-time"];
  return `:root {
    --wa-primary: ${c.primary};
    --wa-secondary: ${c.secondary};
    --wa-text-accent: ${c.text};
    --wa-on-primary: ${c.onPrimary};
    --wa-text: ${BASE_COLORS.text};
    --wa-text-secondary: ${BASE_COLORS.textSecondary};
    --wa-border: ${BASE_COLORS.border};
    --wa-surface: ${BASE_COLORS.surface};
    --wa-rubric: ${BASE_COLORS.rubric};
    --wa-copyright: ${BASE_COLORS.copyright};
  }`;
}

function pageToHtml(page: EditorDocument["pages"][0], season: string): string {
  const elements = page.elements
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(elementToHTML)
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${PREVIEW_FONTS}
${themeCss(season)}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
div, img { break-inside: avoid; }
@page {
  size: ${page.pageSize.width}mm ${page.pageSize.height}mm;
  margin: 0;
}
body {
  width: ${page.pageSize.width}mm;
  height: ${page.pageSize.height}mm;
  position: relative;
  overflow: hidden;
  background: ${page.backgroundColor};
  font-family: 'Crimson Pro', Georgia, serif;
  color: #1A1A1A;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
</style></head><body>${elements}</body></html>`;
}

// mm to inches
function mmToIn(mm: number): number {
  return mm / 25.4;
}

interface ExportRequest {
  document: EditorDocument;
  format: FoldFormat | "FLAT";
  marks?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportRequest;
    const { document: doc, format, marks = true } = body;

    if (!doc.pages.length) {
      return NextResponse.json({ error: "No pages to export" }, { status: 400 });
    }

    // Page size validation for imposed formats
    if (format !== "FLAT") {
      const expectedWidthIn = format === "LEGAL_BIFOLD" ? 7 : format === "TABLOID_TRIFOLD" ? 17 / 3 : 5.5;
      const expectedHeightIn = format === "TABLOID_TRIFOLD" ? 11 : 8.5;
      for (const page of doc.pages) {
        const actualW = mmToIn(page.pageSize.width);
        const actualH = mmToIn(page.pageSize.height);
        if (Math.abs(actualW - expectedWidthIn) > 0.5 || Math.abs(actualH - expectedHeightIn) > 0.5) {
          return NextResponse.json({
            error: `Page size mismatch: editor pages are ${actualW.toFixed(1)}"x${actualH.toFixed(1)}" but ${format} expects ${expectedWidthIn}"x${expectedHeightIn}" panels. Use Flat export or change page size.`,
          }, { status: 400 });
        }
      }
    }

    // Launch browser once, reuse for all pages
    const browser = await launchBrowser();

    try {
      // Render each page to a single-page PDF (reuse one browser tab for speed)
      const pagePdfs: Uint8Array[] = [];
      const tab = await browser.newPage();
      for (const page of doc.pages) {
        const html = pageToHtml(page, doc.globalStyles.season);
        await tab.setContent(html, { waitUntil: ["load"] });
        const pdf = await tab.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          width: `${mmToIn(page.pageSize.width)}in`,
          height: `${mmToIn(page.pageSize.height)}in`,
          margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
          pageRanges: "1",
        });
        pagePdfs.push(new Uint8Array(pdf));
      }
      await tab.close();

      let finalPdf: Uint8Array;

      if (format === "FLAT") {
        const { PDFDocument } = await import("pdf-lib");
        const outDoc = await PDFDocument.create();
        for (const buf of pagePdfs) {
          const srcDoc = await PDFDocument.load(buf);
          const [copied] = await outDoc.copyPages(srcDoc, [0]);
          outDoc.addPage(copied);
        }
        finalPdf = await outDoc.save();
      } else {
        finalPdf = await generateImposedPDF(pagePdfs, format, {
          marks: { enabled: marks, drawPanelCropMarks: true, drawFoldMarks: true, drawRegistration: true },
          creep: { enabled: format === "HALF_LETTER_SADDLE_STITCH" },
          strictSinglePageInput: true,
        });
      }

      return new NextResponse(Buffer.from(finalPdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${doc.metadata.title || "worship-aid"}.pdf"`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
