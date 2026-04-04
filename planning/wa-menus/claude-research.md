# Research Findings: Worship Aid & Menu Generator

## PDF Generation Architecture (from GPT-5.2 via OpenRouter)

### Recommended Approach: Hybrid Puppeteer + pdf-lib

**For text/cover pages (HTML→PDF):** Puppeteer-core + @sparticuz/chromium
- Works on Vercel serverless (Node.js runtime, NOT edge)
- Need 1-2GB memory allocation for reliable rendering
- Cold start ~1-5 seconds, acceptable for 50-100 PDFs/week
- `preferCSSPageSize: true` + `printBackground: true` for full CSS @page support
- Must wait for `document.fonts.ready` before printing
- Self-host fonts (inline base64 or own CDN) to avoid network failures on cold start

**For assembling existing PDFs (sheet music reprints):** pdf-lib
- Preserves vector quality when copying pages from existing PDFs
- Can embed cover images (PNG/JPG) as full-bleed pages
- Can add page numbers, watermarks, parish branding across all pages
- Fast, no browser needed, runs in any serverless function

**Why hybrid?** Rendering existing PDFs through Chromium would rasterize them (quality loss). pdf-lib copies PDF pages natively, preserving vector sheet music quality.

### Architecture Pattern
```
/api/generate/setlist-menu → Puppeteer renders HTML template → returns PDF bytes
/api/generate/worship-aid  → Puppeteer renders cover + text pages
                           → pdf-lib merges: cover PDF + music reprint PDFs + text PDF
                           → saves to Supabase storage → returns URL
```

### Key Code Patterns

**Puppeteer on Vercel:**
```ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: ["load", "networkidle0"] });
await page.evaluate(() => document.fonts.ready);
const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
await browser.close();
```

**pdf-lib assembly:**
```ts
import { PDFDocument } from "pdf-lib";

const out = await PDFDocument.create();
// 1. Cover image as page
const coverImg = await out.embedPng(coverImageBytes);
const coverPage = out.addPage([coverImg.width, coverImg.height]);
coverPage.drawImage(coverImg, { x: 0, y: 0, width: coverImg.width, height: coverImg.height });
// 2. Copy existing music PDF pages (vector preserved)
for (const musicBytes of musicPdfBytesList) {
  const src = await PDFDocument.load(musicBytes);
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach(p => out.addPage(p));
}
// 3. Add Puppeteer-rendered text pages
const textDoc = await PDFDocument.load(textPdfBytes);
const textPages = await out.copyPages(textDoc, textDoc.getPageIndices());
textPages.forEach(p => out.addPage(p));
```

### Print CSS Best Practices
```css
@page { size: letter; margin: 12mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { break-after: page; }
.no-break { break-inside: avoid; }
```

### Performance / Caching
- Cache generated PDFs in Supabase storage with key: `{parish}/{occasion}/{ensemble}/{hash}`
- Serve cached PDFs instantly, regenerate only when setlist changes
- Keep HTML self-contained (inline CSS, inline fonts, data-URLs for images)
- At 50-100 PDFs/week, no need for external hosted service (Browserless etc.)

### Alternatives Considered and Rejected
- **react-pdf/renderer**: Already in use, too limited for complex layouts (no real CSS, no image compositing)
- **Satori + resvg**: Good for OG images, not for multi-page print documents
- **Playwright**: Heavier than Puppeteer for "just render PDFs"
- **Hosted services (Browserless/PDFShift)**: Unnecessary at this volume, adds vendor dependency
- **Apple Pages**: Not programmable, doesn't scale

## Existing Codebase Context (from this session)

### Data Layer
- `songs` table: 3,158 songs, 2,006 with catalog numbers
- `song_resources_v2` table: 11,877 OCP resources (sheet_music PDFs, lyrics, audio)
- `song_resources` (v1): only 4 rows, app reads from this - NEEDS SWITCH TO V2
- `song-resources` storage bucket: actual PDFs verified serving (42KB+ real files)
- Resource tags: CC, CONG, GTR, INST, KBD, LYR
- All resources sourced from ocp_bb (Breaking Bread)

### Asset Libraries
- 870 song folders in Monica Music Master (READ-ONLY, local Dropbox)
- 1,415 worship aid cover images across 6 liturgical cycles
- SMPREP brand: three-cross logo (SVG/PNG), Eidetic Neo (4 weights), Minion Pro (10 weights)
- Cover naming convention: YYMMDD OccasionCode (maps to liturgical calendar)

### Existing Components to Replace
- `src/components/setlist/pdf/SetlistPDF.tsx` (react-pdf, basic text)
- `src/components/setlist/pdf/WorshipAidPDF.tsx` (react-pdf, basic text)
- `src/components/setlist/SetlistExportButton.tsx` (lazy-loads react-pdf)
- `src/components/setlist/WorshipAidExportButton.tsx` (lazy-loads react-pdf)

### Existing Infrastructure to Leverage
- `src/lib/supabase/songs.ts` - song/resource loading (needs v2 switch)
- `src/components/library/ResourceLink.tsx` - already handles PDF preview/download
- `src/app/api/songs/[id]/resources/` - upload/download/signed-url routes
- `src/tools/recommendation/scoring.ts` - liturgical scoring engine
- Planner grid with song positions, personnel, ensembles
- Occasion pages with action bars (already has Setlist/Worship Aid buttons)
