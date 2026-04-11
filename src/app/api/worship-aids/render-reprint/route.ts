/**
 * GET /api/worship-aids/render-reprint?url=ENCODED_URL
 * Converts PDF or TIFF reprint files to browser-renderable PNG.
 * Uses Puppeteer for PDFs, sharp for TIFFs.
 * Admin-only. Caches rendered PNGs for 1 hour.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { launchBrowser } from "@/imposition/puppeteer";

export const runtime = "nodejs";
export const maxDuration = 30;

// In-memory cache: URL -> PNG buffer (cleared on restart)
const cache = new Map<string, { png: Uint8Array; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour

function isCacheValid(entry: { ts: number }): boolean {
  return Date.now() - entry.ts < CACHE_TTL;
}

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url query param required" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(url);
  if (cached && isCacheValid(cached)) {
    return new NextResponse(Buffer.from(cached.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    const lower = url.toLowerCase();
    let png: Uint8Array;

    if (lower.endsWith(".pdf")) {
      png = await renderPdfToPng(url);
    } else if (lower.endsWith(".tif") || lower.endsWith(".tiff")) {
      png = await renderTiffToPng(url);
    } else {
      // For regular images, just proxy them
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      png = new Uint8Array(await res.arrayBuffer());
      return new NextResponse(Buffer.from(png), {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") || "image/png",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Cache the rendered PNG
    cache.set(url, { png, ts: Date.now() });

    return new NextResponse(Buffer.from(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Render first page of a PDF to PNG using Puppeteer.
 */
async function renderPdfToPng(pdfUrl: string): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Embed the PDF in an iframe and screenshot it
    // Better approach: use pdf.js to render in a canvas
    const html = `<!DOCTYPE html>
<html><head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs" type="module"></script>
<style>
  * { margin: 0; padding: 0; }
  body { background: white; }
  canvas { display: block; width: 100%; }
</style>
</head><body>
<canvas id="pdf-canvas"></canvas>
<script type="module">
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument('${pdfUrl}').promise;
  const pg = await pdf.getPage(1);
  const scale = 3;
  const viewport = pg.getViewport({ scale });
  const canvas = document.getElementById('pdf-canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await pg.render({ canvasContext: ctx, viewport }).promise;
  document.title = 'DONE';
</script>
</body></html>`;

    await page.setContent(html, { waitUntil: ["load"] });

    // Wait for PDF.js to finish rendering
    await page.waitForFunction(() => document.title === "DONE", { timeout: 15000 });

    // Get the canvas dimensions and screenshot just the canvas
    const canvasHandle = await page.$("#pdf-canvas");
    if (!canvasHandle) throw new Error("Canvas not found after PDF render");

    const screenshot = await canvasHandle.screenshot({ type: "png" });
    await page.close();
    return new Uint8Array(screenshot);
  } finally {
    await browser.close();
  }
}

/**
 * Convert TIFF to PNG using sharp.
 */
async function renderTiffToPng(tiffUrl: string): Promise<Uint8Array> {
  const res = await fetch(tiffUrl);
  if (!res.ok) throw new Error(`Fetch TIFF failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // Use sharp for TIFF -> PNG conversion
  const sharp = (await import("sharp")).default;
  const png = await sharp(buffer).png().toBuffer();
  return new Uint8Array(png);
}
