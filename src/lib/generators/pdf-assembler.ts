import { PDFDocument, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { BrandConfig } from "./types";

const LETTER_WIDTH = 612; // 8.5in at 72dpi
const LETTER_HEIGHT = 792; // 11in at 72dpi
const BANNER_HEIGHT = 48; // pt, branded strip above reprints

/**
 * Create a new PDF document and embed a cover image as the first page.
 * Image is drawn full-bleed at letter size.
 */
export async function createCoverPage(
  imageBytes: Uint8Array,
  format: "png" | "jpg"
): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const image =
    format === "png"
      ? await doc.embedPng(imageBytes)
      : await doc.embedJpg(imageBytes);

  const page = doc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: LETTER_WIDTH,
    height: LETTER_HEIGHT,
  });

  return doc;
}

/**
 * Copy all pages from a source PDF into a target PDF.
 * Returns the number of pages copied.
 */
export async function copyPagesFrom(
  target: PDFDocument,
  sourceBytes: Uint8Array
): Promise<number> {
  const source = await PDFDocument.load(sourceBytes);
  const indices = source.getPageIndices();
  const copiedPages = await target.copyPages(source, indices);
  for (const page of copiedPages) {
    target.addPage(page);
  }
  return copiedPages.length;
}

/**
 * Add a branded banner header overlay to the first page of a reprint.
 * In banner mode: shifts content down and draws a colored strip at top.
 * The page height increases by BANNER_HEIGHT to preserve content.
 */
export async function addBannerOverlay(
  doc: PDFDocument,
  pageIndex: number,
  brand: BrandConfig,
  songTitle: string
): Promise<void> {
  const page = doc.getPage(pageIndex);
  const { width, height } = page.getSize();

  // Expand page height to make room for the banner
  page.setSize(width, height + BANNER_HEIGHT);

  // Move existing content down by translating the content stream
  page.translateContent(0, 0); // Content stays at bottom; banner goes on top

  // Draw banner background
  const primaryRgb = hexToRgb(brand.primaryColor);
  page.drawRectangle({
    x: 0,
    y: height, // Top of original page = bottom of new banner area
    width,
    height: BANNER_HEIGHT,
    color: rgb(primaryRgb.r, primaryRgb.g, primaryRgb.b),
  });

  // Draw song title in banner
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 11;
  const textWidth = font.widthOfTextAtSize(songTitle, fontSize);
  page.drawText(songTitle, {
    x: (width - textWidth) / 2,
    y: height + (BANNER_HEIGHT - fontSize) / 2,
    size: fontSize,
    font,
    color: rgb(1, 1, 1),
  });

  // Draw parish name (small, right-aligned)
  if (brand.parishDisplayName) {
    const smallFont = await doc.embedFont(StandardFonts.Helvetica);
    const smallSize = 7;
    const nameWidth = smallFont.widthOfTextAtSize(
      brand.parishDisplayName,
      smallSize
    );
    page.drawText(brand.parishDisplayName, {
      x: width - nameWidth - 12,
      y: height + 6,
      size: smallSize,
      font: smallFont,
      color: rgb(0.85, 0.85, 0.85),
    });
  }
}

/**
 * Add a replace-mode header overlay to the first page of a reprint.
 * Draws a white rectangle over the original title area, then draws branded text.
 * replaceHeight controls how much of the top to cover (default 50pt).
 */
export async function addReplaceOverlay(
  doc: PDFDocument,
  pageIndex: number,
  brand: BrandConfig,
  songTitle: string,
  replaceHeight: number = 50
): Promise<void> {
  const page = doc.getPage(pageIndex);
  const { width, height } = page.getSize();

  // White-out the original title area
  page.drawRectangle({
    x: 0,
    y: height - replaceHeight,
    width,
    height: replaceHeight,
    color: rgb(1, 1, 1),
  });

  // Draw branded replacement
  const primaryRgb = hexToRgb(brand.primaryColor);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 12;
  const textWidth = font.widthOfTextAtSize(songTitle, fontSize);

  page.drawText(songTitle, {
    x: (width - textWidth) / 2,
    y: height - replaceHeight / 2 - fontSize / 2,
    size: fontSize,
    font,
    color: rgb(primaryRgb.r, primaryRgb.g, primaryRgb.b),
  });

  // Parish name small below
  if (brand.parishDisplayName) {
    const smallFont = await doc.embedFont(StandardFonts.Helvetica);
    const smallSize = 7;
    const nameWidth = smallFont.widthOfTextAtSize(brand.parishDisplayName, smallSize);
    page.drawText(brand.parishDisplayName, {
      x: (width - nameWidth) / 2,
      y: height - replaceHeight + 6,
      size: smallSize,
      font: smallFont,
      color: rgb(0.6, 0.6, 0.6),
    });
  }
}

/**
 * Embed a GIF image as a full page in a PDF.
 * GIFs are converted to PNG-compatible raster pages.
 * Note: pdf-lib doesn't support GIF natively, so caller must
 * convert GIF to PNG bytes before calling this.
 */
export async function embedImagePage(
  doc: PDFDocument,
  imageBytes: Uint8Array,
  format: "png" | "jpg"
): Promise<void> {
  const image =
    format === "png"
      ? await doc.embedPng(imageBytes)
      : await doc.embedJpg(imageBytes);

  const imgDims = image.scale(1);

  // Scale to fit letter width, maintaining aspect ratio
  const scale = Math.min(
    LETTER_WIDTH / imgDims.width,
    LETTER_HEIGHT / imgDims.height
  );
  const scaledWidth = imgDims.width * scale;
  const scaledHeight = imgDims.height * scale;

  const page = doc.addPage([LETTER_WIDTH, LETTER_HEIGHT]);
  page.drawImage(image, {
    x: (LETTER_WIDTH - scaledWidth) / 2,
    y: LETTER_HEIGHT - scaledHeight, // Top-aligned
    width: scaledWidth,
    height: scaledHeight,
  });
}

/**
 * Add page numbers to all pages in the document.
 * Numbers are centered at the bottom of each page.
 */
export async function addPageNumbers(
  doc: PDFDocument,
  startPage: number = 0
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const fontSize = 9;

  for (let i = startPage; i < pages.length; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const pageNum = `${i + 1}`;
    const textWidth = font.widthOfTextAtSize(pageNum, fontSize);

    page.drawText(pageNum, {
      x: (width - textWidth) / 2,
      y: 24,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
}

/**
 * Merge Puppeteer-rendered PDF bytes into a target document.
 */
export async function mergePuppeteerPdf(
  target: PDFDocument,
  pdfBytes: Uint8Array
): Promise<number> {
  return copyPagesFrom(target, pdfBytes);
}

/**
 * Assemble a final PDF from multiple sections and save to bytes.
 */
export async function assembleFinalPdf(
  doc: PDFDocument
): Promise<Uint8Array> {
  return doc.save();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  return {
    r: parseInt(cleaned.substring(0, 2), 16) / 255,
    g: parseInt(cleaned.substring(2, 4), 16) / 255,
    b: parseInt(cleaned.substring(4, 6), 16) / 255,
  };
}
