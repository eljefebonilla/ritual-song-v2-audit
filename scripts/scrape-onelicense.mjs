#!/usr/bin/env node
/**
 * OneLicense Scraper: Search songs, download TIFF/GIF reprints + TXT lyrics.
 *
 * Phase 1: Scrape download URLs for all songs (saves manifest.json)
 * Phase 2: Download files using browser session (saves to ~/Desktop/OneLicense Downloads/)
 * Phase 3: Upload to Supabase (separate script)
 *
 * Usage:
 *   npx playwright install chromium   # first time only
 *   node scripts/scrape-onelicense.mjs --scrape     # Phase 1: collect URLs
 *   node scripts/scrape-onelicense.mjs --download   # Phase 2: download files
 *   node scripts/scrape-onelicense.mjs --all        # Both phases
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const MANIFEST_PATH = join(root, "scripts/onelicense-manifest.json");
const DOWNLOAD_DIR = join(process.env.HOME, "Desktop/OneLicense Downloads");
const GAP_REPORT = join(root, "scripts/reprint-gap-report.json");

// Songs from the gap report + all songs missing TXT
function getTargetSongs() {
  const gap = JSON.parse(readFileSync(GAP_REPORT, "utf-8"));

  // Gap songs (need CONG reprints)
  const gapTitles = gap.gapList
    .map((e) => e.title)
    .filter((t) => {
      // Skip junk entries
      if (t.startsWith('"') || t.startsWith("\u201c")) return false;
      if (t === "\u2014" || t.startsWith("ORDINARY") || t.startsWith("CHRISTMAS")) return false;
      if (t.startsWith("FEBRUARY") || t.startsWith("Composer") || t.startsWith("TUNE")) return false;
      if (t.startsWith("Will not") || t.startsWith("Basic") || t.startsWith("33 ")) return false;
      return true;
    });

  // Also include covered songs that might be missing TXT
  const coveredTitles = gap.covered.map((e) => e.title);

  // Deduplicate
  const all = [...new Set([...gapTitles, ...coveredTitles])];
  return all;
}

async function login(page) {
  await page.goto("https://www.onelicense.net/login");

  // Cloudflare may show a challenge. Wait up to 30s for it to resolve.
  console.log("  Waiting for Cloudflare challenge (may need manual click)...");
  for (let i = 0; i < 30; i++) {
    const url = page.url();
    if (url.includes("/login") && !url.includes("cf_chl")) {
      const hasForm = await page.locator('input[name="email"]').count();
      if (hasForm > 0) break;
    }
    if (url.includes("/home")) {
      console.log("  Already logged in");
      return;
    }
    await page.waitForTimeout(1000);
  }

  await page.fill('input[name="email"]', "jeffrey@stmonica.net");
  await page.fill('input[name="password"]', "Welcome2013");
  await page.click('button[name="submit"]');

  // Wait for redirect to home, with generous timeout for Cloudflare
  for (let i = 0; i < 20; i++) {
    if (page.url().includes("/home")) break;
    await page.waitForTimeout(1000);
  }
  console.log("  Logged in at:", page.url());
}

async function scrapeUrls(page, title) {
  const encoded = encodeURIComponent(title).replace(/%20/g, "+");
  const url = `https://www.onelicense.net/search?term=${encoded}&hymnal=&hymn=&page=1&type=submit-term&addition=&downloads-only=true`;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const songs = document.querySelectorAll(".search-music-results");
      if (!songs.length) return null;
      const song = songs[0];
      const info = song.innerText.substring(0, 200);
      const links = Array.from(song.querySelectorAll('a[href*="/files/"]'));
      const dl = {};
      for (const a of links) {
        const h = a.href;
        if (h.includes("/files/tif/") && !h.includes("part=") && !dl.tif) dl.tif = h;
        if (h.includes("/files/gif/") && h.includes("part=1") && !dl.gif) dl.gif = h;
        if (h.includes("/files/txt/") && !dl.txt) dl.txt = h;
      }
      return { info, ...dl };
    });

    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function downloadFile(page, url, filepath) {
  try {
    const download = await page.waitForEvent("download", {
      timeout: 15000,
      predicate: () => true,
    });
    // Navigate to trigger download
    await page.evaluate((u) => {
      const a = document.createElement("a");
      a.href = u;
      a.click();
    }, url);
    // Actually, downloads from links need a different approach
  } catch {
    // Fallback: use page.request to fetch with cookies
  }

  // Better approach: use the page context to fetch
  const response = await page.request.get(url);
  if (response.ok()) {
    const buffer = await response.body();
    writeFileSync(filepath, buffer);
    return buffer.length;
  }
  return 0;
}

// ── Phase 1: Scrape URLs ────────────────────────────────────────────────────

async function phaseScrape() {
  const titles = getTargetSongs();
  console.log(`\n=== PHASE 1: Scraping ${titles.length} song URLs from OneLicense ===\n`);

  // Load existing manifest if resuming
  let manifest = {};
  if (existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    console.log(`  Resuming: ${Object.keys(manifest).length} already scraped\n`);
  }

  // Connect to existing Chrome with remote debugging
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // Verify we're logged in by navigating to home
  await page.goto("https://www.onelicense.net/home", { waitUntil: "networkidle", timeout: 15000 });
  if (page.url().includes("/home")) {
    console.log("  Connected to Chrome, already logged in");
  } else {
    console.log("  WARNING: Not logged in. Please log in manually and re-run.");
    await browser.close();
    process.exit(1);
  }

  let scraped = 0;
  let found = 0;
  for (const title of titles) {
    if (manifest[title]) {
      continue; // Already scraped
    }

    const result = await scrapeUrls(page, title);
    const hasImg = result && (result.tif || result.gif);
    const hasTxt = result && result.txt;
    const status = hasImg && hasTxt ? "IMG+TXT" : hasImg ? "IMG" : hasTxt ? "TXT" : "NONE";

    manifest[title] = result || { error: "no results" };
    scraped++;
    if (hasImg || hasTxt) found++;

    process.stdout.write(
      `  [${String(scraped).padStart(3)}/${titles.length - Object.keys(manifest).length + scraped}] [${status.padEnd(7)}] ${title.substring(0, 50)}\n`
    );

    // Save every 10 songs
    if (scraped % 10 === 0) {
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  await page.close();
  browser.close();

  const total = Object.keys(manifest).length;
  const withImg = Object.values(manifest).filter((r) => r.tif || r.gif).length;
  const withTxt = Object.values(manifest).filter((r) => r.txt).length;
  console.log(`\n=== Scrape complete ===`);
  console.log(`  Total: ${total} songs`);
  console.log(`  With TIFF/GIF: ${withImg}`);
  console.log(`  With TXT: ${withTxt}`);
  console.log(`  Manifest: ${MANIFEST_PATH}`);
}

// ── Phase 2: Download Files ─────────────────────────────────────────────────

async function phaseDownload() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error("No manifest found. Run --scrape first.");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  mkdirSync(DOWNLOAD_DIR, { recursive: true });
  mkdirSync(join(DOWNLOAD_DIR, "tif"), { recursive: true });
  mkdirSync(join(DOWNLOAD_DIR, "gif"), { recursive: true });
  mkdirSync(join(DOWNLOAD_DIR, "txt"), { recursive: true });

  // Collect all downloads
  const downloads = [];
  for (const [title, data] of Object.entries(manifest)) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 60);

    if (data.tif) {
      const ext = "tif";
      const path = join(DOWNLOAD_DIR, ext, `${slug}.${ext}`);
      if (!existsSync(path)) downloads.push({ title, url: data.tif, path, type: ext });
    } else if (data.gif) {
      const ext = "gif";
      const path = join(DOWNLOAD_DIR, ext, `${slug}.${ext}`);
      if (!existsSync(path)) downloads.push({ title, url: data.gif, path, type: ext });
    }
    if (data.txt) {
      const path = join(DOWNLOAD_DIR, "txt", `${slug}.txt`);
      if (!existsSync(path)) downloads.push({ title, url: data.txt, path, type: "txt" });
    }
  }

  console.log(`\n=== PHASE 2: Downloading ${downloads.length} files ===\n`);

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = await context.newPage();
  await page.goto("https://www.onelicense.net/home", { waitUntil: "networkidle", timeout: 15000 });

  let done = 0;
  let errors = 0;
  for (const dl of downloads) {
    try {
      const response = await page.request.get(dl.url);
      if (response.ok()) {
        const buffer = await response.body();
        writeFileSync(dl.path, buffer);
        done++;
        process.stdout.write(
          `  [${String(done).padStart(3)}/${downloads.length}] ${dl.type.toUpperCase()} ${dl.title.substring(0, 45)} (${(buffer.length / 1024).toFixed(0)} KB)\n`
        );
      } else {
        errors++;
        console.log(`  ERROR ${dl.title}: HTTP ${response.status()}`);
      }
    } catch (e) {
      errors++;
      console.log(`  ERROR ${dl.title}: ${e.message}`);
    }
  }

  await page.close();
  browser.close();

  console.log(`\n=== Download complete ===`);
  console.log(`  Downloaded: ${done}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Location: ${DOWNLOAD_DIR}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doScrape = args.includes("--scrape") || args.includes("--all");
const doDownload = args.includes("--download") || args.includes("--all");

if (!doScrape && !doDownload) {
  console.log("Usage:");
  console.log("  node scripts/scrape-onelicense.mjs --scrape     # Collect download URLs");
  console.log("  node scripts/scrape-onelicense.mjs --download   # Download files");
  console.log("  node scripts/scrape-onelicense.mjs --all        # Both");
  process.exit(0);
}

if (doScrape) await phaseScrape();
if (doDownload) await phaseDownload();
