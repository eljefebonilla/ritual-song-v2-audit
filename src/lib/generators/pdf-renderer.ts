import type { Browser } from "puppeteer-core";
import type { FontAsset } from "./types";

/**
 * Launch a headless Chromium browser for PDF rendering.
 * Uses @sparticuz/chromium for serverless (Vercel) compatibility.
 * Caller is responsible for closing the browser when done.
 */
export async function launchBrowser(): Promise<Browser> {
  const chromium = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");

  const executablePath = await chromium.default.executablePath();

  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath,
    headless: true,
  });

  return browser;
}

/**
 * Render an HTML string to PDF bytes using an existing browser instance.
 * Waits for all fonts to load before rendering.
 */
export async function renderPdf(
  browser: Browser,
  html: string,
  options?: {
    width?: string;
    height?: string;
    landscape?: boolean;
  }
): Promise<Uint8Array> {
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for base64-inlined fonts to be parsed and ready
    await page.evaluate(() => document.fonts.ready);

    const pdfBuffer = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      width: options?.width,
      height: options?.height,
      landscape: options?.landscape ?? false,
    });

    return new Uint8Array(pdfBuffer);
  } finally {
    await page.close();
  }
}

/**
 * Build @font-face CSS declarations from base64-encoded font assets.
 * Inlined directly into HTML to avoid network fetches on cold start.
 */
export function buildFontFaceCss(fonts: FontAsset[]): string {
  return fonts
    .map(
      (f) =>
        `@font-face {
  font-family: "${f.family}";
  font-weight: ${f.weight};
  font-style: ${f.style};
  src: url(data:font/${f.format};base64,${f.base64}) format("${f.format}");
  font-display: block;
}`
    )
    .join("\n\n");
}
