/**
 * HTML to single-page PDF using puppeteer-core + @sparticuz/chromium.
 * Used by the export API route to render each page of the worship aid.
 */
import puppeteer, { type Browser } from "puppeteer-core";

let chromiumPath: string | null = null;

async function getChromiumPath(): Promise<string> {
  if (chromiumPath) return chromiumPath;

  // Local development: use installed Chrome
  if (process.env.NODE_ENV === "development") {
    const candidates = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      process.env.CHROME_PATH,
    ].filter(Boolean) as string[];

    const { existsSync } = await import("node:fs");
    for (const p of candidates) {
      if (existsSync(p)) { chromiumPath = p; return p; }
    }
  }

  // Serverless: @sparticuz/chromium
  const chromium = await import("@sparticuz/chromium");
  chromiumPath = await chromium.default.executablePath();
  return chromiumPath;
}

/**
 * Launch a browser instance using the resolved Chrome path.
 */
export async function launchBrowser(): Promise<Browser> {
  const executablePath = await getChromiumPath();
  const isDev = process.env.NODE_ENV === "development";
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: isDev
      ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
      : ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
}

export interface HtmlToPdfOptions {
  widthIn: number;
  heightIn: number;
  deviceScaleFactor?: number;
  preferCSSPageSize?: boolean;
  browser?: Browser;
}

/**
 * Render a single HTML string to a single-page PDF buffer at exact dimensions.
 */
export async function renderHtmlToSinglePagePdf(
  html: string,
  opts: HtmlToPdfOptions,
): Promise<Uint8Array> {
  const {
    widthIn,
    heightIn,
    deviceScaleFactor = 300 / 96,
    preferCSSPageSize = false,
    browser: providedBrowser,
  } = opts;

  const browser = providedBrowser ?? (await puppeteer.launch({
    executablePath: await getChromiumPath(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  }));

  try {
    const page = await browser.newPage();

    const vpW = Math.ceil(widthIn * 96 * deviceScaleFactor);
    const vpH = Math.ceil(heightIn * 96 * deviceScaleFactor);

    await page.setViewport({ width: vpW, height: vpH, deviceScaleFactor });
    await page.setContent(html, { waitUntil: ["load", "networkidle0"] });

    const pdfBytes = await page.pdf({
      printBackground: true,
      preferCSSPageSize,
      width: `${widthIn}in`,
      height: `${heightIn}in`,
      margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
      pageRanges: "1",
    });

    return new Uint8Array(pdfBytes);
  } finally {
    if (!providedBrowser) {
      await browser.close();
    }
  }
}
