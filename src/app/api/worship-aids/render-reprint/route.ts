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
    } else if (lower.endsWith(".gif")) {
      // GIFs need conversion to PNG for consistent handling
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const sharp = (await import("sharp")).default;
      const buf = Buffer.from(await res.arrayBuffer());
      const trimmed = await sharp(buf).png().toBuffer();
      png = new Uint8Array(trimmed);
    } else {
      // For regular images (PNG, JPG), fetch and auto-trim
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      png = new Uint8Array(await res.arrayBuffer());
    }

    // Auto-trim whitespace: remove surrounding white margins for uniform alignment
    png = await autoTrimWhitespace(png);

    // Cache the rendered + trimmed PNG
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
 * Render first page of a PDF to PNG.
 * Uses macOS sips in dev (no dependencies), Puppeteer in production.
 */
async function renderPdfToPng(pdfUrl: string): Promise<Uint8Array> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Fetch PDF failed: ${res.status}`);
  const pdfBuffer = Buffer.from(await res.arrayBuffer());

  const { writeFileSync, readFileSync, unlinkSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const id = `reprint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tmpPdf = join(tmpdir(), `${id}.pdf`);
  const tmpPng = join(tmpdir(), `${id}.png`);

  try {
    writeFileSync(tmpPdf, pdfBuffer);

    if (process.platform === "darwin") {
      // macOS: sips for fast PDF->PNG (no shell injection: execFileSync with array args)
      execFileSync("sips", [
        "-s", "format", "png",
        "-s", "dpiHeight", "200",
        "-s", "dpiWidth", "200",
        tmpPdf,
        "--out", tmpPng,
      ], { timeout: 10000 });
    } else {
      // Linux/serverless: Puppeteer fallback
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
        await page.goto(`file://${tmpPdf}`, { waitUntil: ["load"] });
        const screenshot = await page.screenshot({ type: "png", fullPage: true });
        writeFileSync(tmpPng, screenshot);
        await page.close();
      } finally {
        await browser.close();
      }
    }

    const png = readFileSync(tmpPng);
    return new Uint8Array(png);
  } finally {
    try { unlinkSync(tmpPdf); } catch {}
    try { unlinkSync(tmpPng); } catch {}
  }
}

/**
 * Convert TIFF to PNG using sharp.
 */
async function renderTiffToPng(tiffUrl: string): Promise<Uint8Array> {
  const res = await fetch(tiffUrl);
  if (!res.ok) throw new Error(`Fetch TIFF failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  const sharp = (await import("sharp")).default;
  const png = await sharp(buffer).png().toBuffer();
  return new Uint8Array(png);
}

/**
 * Auto-trim whitespace from reprint images.
 * Detects near-white margins and removes them, then adds a small
 * uniform padding so all reprints align consistently.
 */
async function autoTrimWhitespace(input: Uint8Array): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const PADDING_PX = 20; // uniform padding after trim

  try {
    // sharp.trim() removes borders matching the top-left pixel color
    // threshold: how much color difference to tolerate (0-255)
    const trimmed = await sharp(Buffer.from(input))
      .trim({ threshold: 30 })
      .toBuffer();

    // Add uniform padding back
    const metadata = await sharp(trimmed).metadata();
    const w = metadata.width ?? 600;
    const h = metadata.height ?? 800;

    const padded = await sharp(trimmed)
      .extend({
        top: PADDING_PX,
        bottom: PADDING_PX,
        left: PADDING_PX,
        right: PADDING_PX,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    return new Uint8Array(padded);
  } catch {
    // If trim fails (e.g., fully white image), return original
    return input;
  }
}
