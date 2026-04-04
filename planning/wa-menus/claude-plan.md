# Implementation Plan: Worship Aid & Menu Generator

## 1. Project Overview

Ritual Song v2 is a Next.js/Supabase church music ministry SaaS app. Directors currently hand-build two weekly documents in Apple Pages: a setlist/menu for musicians and a worship aid for the assembly. This project auto-generates both at publication quality, with per-parish branding and layout customization.

The app already has a planner grid with song assignments, a recommendation engine, 3,158 songs, and 11,877 OCP sheet music resources in Supabase. The generation infrastructure does not exist yet. The existing react-pdf components (SetlistPDF.tsx, WorshipAidPDF.tsx) are text-only placeholders that need replacement.

## 2. Architecture Overview

### Generation Pipeline

```
Planner Grid (song assignments + personnel)
        │
        ▼
Auto-detect "setlist complete" ──→ Trigger generation
        │
        ├──→ Setlist/Menu API route
        │     └──→ HTML template + CSS vars ──→ Puppeteer ──→ PDF
        │
        └──→ Worship Aid API route
              ├──→ Cover page: HTML template ──→ Puppeteer ──→ PDF page
              ├──→ Text pages (readings, Order of Mass): HTML ──→ Puppeteer ──→ PDF
              ├──→ Sheet music: fetch reprint PDFs from Supabase storage
              └──→ pdf-lib merges all into single PDF
                    └──→ Cache in Supabase storage
```

### Why Hybrid Puppeteer + pdf-lib

Puppeteer (via @sparticuz/chromium) renders HTML/CSS to PDF with full print CSS support: @page rules, @font-face, flexbox, image compositing. This handles cover pages, text layouts, and branded headers.

pdf-lib merges existing PDF files without rasterizing them, preserving the vector quality of OCP sheet music reprints. Rendering existing PDFs through a browser would degrade them.

### Directory Structure (new files)

```
src/
  lib/
    generators/
      types.ts               # Shared types: GeneratorConfig, BrandConfig, etc.
      setlist-generator.ts    # Setlist/Menu generation orchestrator
      worship-aid-generator.ts # Worship Aid generation orchestrator
      pdf-renderer.ts         # Puppeteer HTML-to-PDF wrapper
      pdf-assembler.ts        # pdf-lib merge/assembly utilities
      template-engine.ts      # HTML template loading + CSS variable injection
      cover-resolver.ts       # Resolve cover image for an occasion
      reprint-resolver.ts     # Resolve sheet music reprints for a song
    supabase/
      songs.ts                # (modify) Switch from song_resources to song_resources_v2
  templates/
    setlist/
      classic.html            # Cathedral/traditional layout
      modern.html             # Clean/minimal layout
      warm.html               # Earthy/friendly layout
      base.css                # Shared print CSS
    worship-aid/
      cover.html              # Cover page template (full-bleed image + text overlay)
      content.html            # Order of Mass / readings / song entries
      header-overlay.html     # Branded header strip for reprints
      base.css                # Shared print CSS
    mobile/
      lyrics.html             # Responsive lyrics-only template
  app/
    api/
      generate/
        setlist/route.ts      # POST: generate setlist PDF
        worship-aid/route.ts  # POST: generate worship aid PDF
        preview/route.ts      # GET: preview HTML before PDF render
    wa/
      [slug]/page.tsx         # Public time-limited lyrics-only view
  components/
    generators/
      GenerateButton.tsx      # Trigger generation with status feedback
      LayoutPresetPicker.tsx  # Visual layout preset selector
      BrandConfigEditor.tsx   # Logo upload, colors, fonts
      CoverArtPicker.tsx      # Upload, gradient, or AI-generate
```

## 3. Section: Data Layer Migration

### 3.1 Fix mapResourceRow (CRITICAL, DO FIRST)

**Bug found during review:** `mapResourceRow` in `src/lib/supabase/songs.ts` does NOT map `tags` or `visibility` from the database row to the `SongResource` interface. The `SongResource` type at `src/lib/types.ts` defines these fields, but the mapper omits them. The reprint resolver needs `tags` to filter for "CONG" resources. Without this fix, every worship aid will silently produce zero sheet music.

Add to `mapResourceRow`:
```ts
tags: (row.tags as string[]) || undefined,
visibility: (row.visibility as string) || undefined,
```

### 3.2 Verify song_resources_v2 Usage

Check whether `songs.ts` already queries `song_resources_v2`. If it does, no table switch is needed, only the `mapResourceRow` fix above. If it still reads from `song_resources` (v1, 4 rows), change to `song_resources_v2` (11,877 rows).

**Schema verification**: Before switching, run a diff of the two table schemas (column names, types, constraints) to confirm they are compatible. Do not assume "nearly identical" without verification. Use `\d song_resources` vs `\d song_resources_v2` in the Supabase SQL editor.

Verify the ResourceLink component still works after the fix. It already handles `storagePath` and `url` from resources.

### 3.2 Cover Art Storage

Create a new storage bucket `cover-art` (or reuse `song-resources` with a `covers/` prefix). Upload St. Monica's 1,415 cover images with keys matching the occasion naming convention: `{parish_id}/covers/{occasion_code}.png`.

**Migration**: Add a `parish_cover_art` table:

```
parish_cover_art
  id: uuid (PK)
  parish_id: uuid (FK parishes)
  occasion_code: text (e.g., "05LENT_A")
  cycle: text (A, B, C)
  image_url: text
  storage_path: text
  source: text (uploaded, gradient, ai_generated)
  created_at: timestamptz
```

The `occasion_code` strips the date prefix and maps to the liturgical calendar. This lets the same image persist across years within a cycle.

### 3.3 Parish Brand Config

**Migration**: Add a `parish_brand_config` table:

```
parish_brand_config
  id: uuid (PK)
  parish_id: uuid (FK parishes, unique)
  logo_url: text
  logo_storage_path: text
  parish_display_name: text (e.g., "st. monica catholic community")
  primary_color: text (hex)
  secondary_color: text (hex)
  accent_color: text (hex)
  heading_font: text (font family name or "preset:cathedral")
  body_font: text
  layout_preset: text (classic, modern, warm)
  cover_style: text (photo, gradient, ai)
  header_overlay_mode: text (banner, replace)
  created_at: timestamptz
  updated_at: timestamptz
```

Fonts for St. Monica (Eidetic Neo + Minion Pro) are uploaded to the `song-resources` bucket under `fonts/`. Other parishes pick from web-safe presets or upload their own.

**Default values required:** New parishes get sensible defaults (primary: #333, secondary: #666, accent: #4A90D9, layout: "modern", heading_font: "Playfair Display", body_font: "Inter"). Never serve null values to templates.

## 4. Section: PDF Rendering Engine

### 4.1 Puppeteer Wrapper (pdf-renderer.ts)

Two functions: one that launches a browser and returns it, one that renders HTML to PDF bytes using an existing browser instance. This allows **browser reuse within a single generation** (e.g., worship aid renders cover + content pages in one browser session, avoiding two cold starts).

Handles:
- Launching Chromium via @sparticuz/chromium (serverless compatible)
- Setting HTML content and waiting for font loading
- Calling `document.fonts.ready` before rendering
- Using `preferCSSPageSize: true` and `printBackground: true`
- Caller is responsible for closing the browser after all renders complete

**Font strategy**: Base64-inline fonts directly into the HTML template (not @font-face URLs). This eliminates network fetch failures on cold start. At 2 font families (4-10 weights), this adds 1-3MB to the HTML payload, which is acceptable for server-side rendering.

**Vercel config**: The API routes need `runtime: "nodejs"` (not edge). **Requires Vercel Pro plan** ($20/month) because @sparticuz/chromium binary is ~50MB, exceeding the Hobby tier's 50MB function size limit.

### 4.2 PDF Assembly (pdf-assembler.ts)

Uses pdf-lib for:
- Creating cover page from image (embedPng/embedJpg, draw full-bleed)
- Copying pages from existing PDFs (sheet music reprints, preserves vector)
- Inserting Puppeteer-rendered pages at correct positions
- Adding page numbers (optional, parish configurable)
- Adding branded header overlays to reprint pages

**Header overlay modes:**
- **Banner mode** (default, recommended): Add a branded strip above each reprint page. Increases page height by the banner amount (40-60pt). If the reprint page size differs from the target (Letter), scale proportionally using pdf-lib's drawPage with calculated width/height to maintain aspect ratio. Reprint content stays legible with no distortion.
- **Replace mode** (experimental, per-song configurable): Draw a white rectangle over the original title area, then draw branded text. Because OCP PDFs have inconsistent title heights and some have copyright notices at the top, this mode requires per-song configuration of the overlay area. Default to banner mode. Only offer replace mode as an advanced option.

**Multi-page reprints**: Some songs span 2+ pages. The assembler copies ALL pages from each reprint PDF. Header overlay applies only to the first page.

**GIF fallback quality**: When only a GIF reprint exists (no PDF), embed it as a raster image page. Warn the director in the UI that this song uses a lower-quality raster reprint. Always prefer PDF over GIF.

### 4.3 Template Engine (template-engine.ts)

Loads HTML template files and injects:
- CSS custom properties from the parish brand config (colors, fonts, spacing)
- Data variables (occasion name, date, songs, personnel, readings)
- Layout preset class on the root element

Templates use CSS custom properties for all branding:

```css
:root {
  --brand-primary: #722F37;    /* injected from parish config */
  --brand-accent: #B8A472;
  --brand-heading-font: "Eidetic Neo", serif;
  --brand-body-font: "Minion Pro", serif;
  --brand-logo-url: url(...);
}
```

Layout presets override these variables:

```css
.preset-cathedral { --heading-size: 1.5rem; --spacing: 1.2; }
.preset-modern { --heading-size: 1.25rem; --spacing: 1.0; --brand-heading-font: Inter, sans-serif; }
.preset-warm { --heading-size: 1.375rem; --spacing: 1.1; }
```

## 5. Section: Setlist/Menu Generator

### 5.1 Data Assembly

Fetch from Supabase:
- Mass event (occasion, date, time, ensemble, celebrant)
- Setlist songs (position, song_id, title, composer, hymnal_number, key)
- Personnel assignments (role, person_name, side)
- Safety song (if assigned)
- Parish brand config

For the combined weekend view, fetch all mass events for the weekend and group by ensemble.

### 5.2 HTML Template

The setlist template renders a single-page (or multi-page if many songs) document:
- **Header**: Parish logo (left), occasion name + date (center), ensemble + Mass time (right)
- **Song table**: Position label (left column, accent color), song title + composer (main column), hymnal number + key (right column)
- **Personnel section**: Two-column layout below songs, grouped by role
- **Safety song**: Dashed border section at bottom
- **Footer**: Parish name, "Generated by Ritual Song", date

For the combined weekend view, each ensemble gets a section with a divider. Page breaks between ensembles.

### 5.3 Generation Flow

1. API route receives `{ massEventId }` (or `{ occasionId, weekendAll: true }`)
2. Fetch data from Supabase
3. Load parish brand config
4. Select template (classic/modern/warm based on config)
5. Inject data + CSS variables into template
6. Render via Puppeteer
7. Cache PDF in storage: `{parish_id}/setlists/{occasion_code}_{ensemble}.pdf`
8. Return PDF URL

## 6. Section: Worship Aid Generator

### 6.1 Data Assembly

Fetch from Supabase:
- Mass event and occasion metadata
- Setlist songs with their resources (join songs + song_resources_v2 where tag includes "CONG")
- Readings (from liturgical_day_readings or liturgical_days table)
- Parish brand config
- Cover art (from parish_cover_art table, matched by occasion_code + cycle)

### 6.2 Cover Page

The cover page is a full-bleed image with text overlay:
- Background: cover art image (or gradient fallback)
- Parish logo (top-left, white variant)
- Parish name (top, small caps, accent color)
- Occasion name (large serif, centered vertically)
- Date (bottom-right, separated by a horizontal rule)

Rendered as a standalone HTML page via Puppeteer, then merged as first page via pdf-lib.

### 6.3 Content Pages (Order of Mass)

HTML template follows the standard Mass structure:
1. Introductory Rites (Gathering song entry)
2. Penitential Act / Gloria (if assigned)
3. Liturgy of the Word (First Reading, Psalm with highlighted response box, Second Reading, Gospel Acclamation, Gospel)
4. Offertory
5. Liturgy of the Eucharist (Mass setting entries)
6. Communion (1-3 songs)
7. Sending Forth

Each song entry shows: position label (small caps, accent), song title, composer. For text pages only (no embedded sheet music), this is a clean typographic layout.

### 6.4 Reprint Assembly

For each song in the setlist:
1. Query `song_resources_v2` for the song_id where tags include "CONG" (congregational)
2. If found, fetch the PDF bytes from Supabase storage
3. Apply header overlay (banner or replace mode per parish config)
4. Insert into the assembled document at the correct liturgical position

**Reprint resolution order** (reprint-resolver.ts):
1. CONG PDF from song_resources_v2 (primary, clean OCP digital)
2. CONG GIF from song_resources_v2 (fallback, convert to PDF page via pdf-lib image embed)
3. If no CONG resource exists, show lyrics-only entry in the text template

### 6.5 Assembly Flow

1. Launch browser (single Chromium instance for the whole generation)
2. Render cover page HTML via Puppeteer (returns PDF bytes)
3. Render content pages HTML via Puppeteer (same browser, returns PDF bytes)
4. Close browser
5. Fetch all reprint PDFs from storage (parallel fetch)
6. Use pdf-lib to assemble in Order of Mass sequence:
   - Cover page
   - For each Mass section: text page(s), then reprint page(s) if applicable
7. Optionally add page numbers
8. Cache: `{parish_id}/worship-aids/{occasion_code}_{hash}.pdf`
9. Return PDF URL

**Error handling**: If a reprint fetch fails, skip it and insert a "sheet music unavailable" placeholder page. Never crash the whole generation for one missing reprint. Log the failure for the director to see in an "Assistant Activity" panel.

## 7. Section: Mobile Lyrics-Only View

### 7.1 Route Structure

`/wa/[slug]` where slug encodes parish + occasion (e.g., `stmonica-260322-05lent-a`).

### 7.2 Time-Limited Access with Signed Slugs

The slug includes an HMAC token: `/wa/{parish-occasion-slug}-{token}` where token = HMAC-SHA256(slug, server secret), truncated to 8 chars. This prevents enumeration of other parishes' worship aids.

The page checks: is the current date within 7 days of the occasion date (using the occasion's timezone)? If not, show an "expired" message with the parish name and a note that this content is no longer available.

No authentication required within the window. The HMAC token prevents guessing URLs for other parishes.

### 7.3 Content

Responsive HTML page (not PDF) showing:
- Parish branding header
- Occasion name and date
- For each song position: title, composer, lyrics text (from LYR resources in song_resources_v2)
- Psalm response in highlighted box
- Reading citations (not full text, for copyright reasons)

Uses the same CSS custom properties as the PDF templates for consistent branding.

## 8. Section: Auto-Generation Trigger

### 8.1 Detection Logic

A setlist is "complete" when all required positions have a song assigned. Required positions vary by parish config but typically: Gathering, Psalm, Offertory, Communion 1, Sending.

### 8.2 Trigger Flow (with debounce)

When a song assignment is saved (via the planner grid CellEditor):
1. Start a 30-second debounce timer for this mass event (resets on each save)
2. After debounce expires, check if setlist is now complete
3. If complete and no cached PDF exists (or cache is stale): queue generation
4. Generation runs asynchronously (API call, not blocking the UI save)
5. Store result in Supabase storage
6. Update mass event record with `generated_at` timestamp and storage paths

The debounce prevents wasteful regeneration when a director is actively editing multiple slots. 30 seconds is long enough to cover rapid edits but short enough to feel responsive.

### 8.3 Regeneration

Directors can click "Regenerate" on the occasion page or setlist print page. This invalidates the cache and re-runs the generation pipeline.

The occasion page action bar (already has Plan a Mass, Setlist PDF, Worship Aid buttons) updates to show generation status: "Generating...", "Ready (generated 2 min ago)", or "Outdated (setlist changed)".

**Status polling**: The client polls the mass event's `generated_at` field every 5 seconds while status is "Generating". When `generated_at` updates, the status switches to "Ready" and shows the download link. Polling stops once the PDF is ready or after 60 seconds (timeout, show error).

## 9. Section: Parish Brand Config UI

### 9.1 Brand Config Editor

A settings page at `/admin/settings/brand` (or within the parish setup wizard) with:
- **Logo upload**: Drag-drop or file picker. Stores in `song-resources` bucket under `{parish_id}/brand/logo.png`.
- **Color palette**: 3 color pickers (primary, secondary, accent) with preset buttons (Cathedral Gold, Ocean Blue, Forest Green, etc.)
- **Font selection**: Dropdown with preset options (Playfair Display + Inter, Merriweather + Source Sans, etc.) and "Upload custom" option
- **Layout preset**: Visual cards showing thumbnail previews of Classic, Modern, Warm layouts. Click to select.
- **Cover style**: Radio buttons: Photo library, Gradient, AI-generated
- **Header overlay**: Toggle between Banner (default) and Replace modes

### 9.2 Live Preview

The brand config editor shows a live thumbnail preview of a sample setlist and worship aid cover. As the director changes settings, the preview updates (client-side HTML render, not server PDF).

## 10. Section: Cover Art Management

### 10.1 St. Monica Migration

**Pre-requisite: audit occasion codes.** Before bulk upload, run a script that:
1. Lists all folder names in the cover art directory
2. Strips the YYMMDD prefix to extract occasion codes
3. Attempts to match each code against the `liturgical_days` table
4. Reports unmatched codes for manual mapping

The occasion code format varies: "05LENT_A", "Nativity", "Holy Family", "Epiphany", "01Advent_A", "Corpus Christi_B". Some include cycle suffixes, some don't. The normalization rules:
- Strip date prefix (first 6-7 chars if numeric)
- Normalize spacing/underscores
- Map common aliases (e.g., "PalmSun" to "Palm Sunday of the Passion")
- For codes with cycle suffix (_A, _B, _C), extract cycle separately

Output: a JSON mapping file reviewed by Jeff before bulk upload proceeds. This prevents orphaned images.

Bulk upload to Supabase storage: `{parish_id}/covers/{normalized_code}_{cycle}.png`.

### 10.2 Cover Art Picker UI

On the occasion page (or a dedicated cover art management page):
- Show current cover art for the occasion
- Upload new image (replaces for this occasion in this cycle)
- "Use gradient" button (generates from season colors)
- "Generate with AI" button (premium, sends occasion name + readings to image generation API)

Uploaded/generated covers persist in `parish_cover_art` table and reappear when the same occasion comes up in the 3-year cycle.

## 11. Section: Vercel Deployment Configuration

### 11.1 Dependencies

New packages:
- `puppeteer-core`: Headless browser control (no bundled Chromium)
- `@sparticuz/chromium`: Serverless-compatible Chromium binary
- `pdf-lib`: PDF creation and manipulation

### 11.2 Vercel Config

```json
// vercel.json additions
{
  "functions": {
    "src/app/api/generate/**/*.ts": {
      "memory": 1536,
      "maxDuration": 60
    }
  }
}
```

**Requires Vercel Pro plan.** @sparticuz/chromium is ~50MB, which exceeds the Hobby tier's 50MB function size limit. Pro allows 250MB functions and up to 300s duration. We use 60s as a reasonable default for worship aids with many reprints (cover render + content render + reprint fetches + assembly).

The generate routes need higher memory (1536MB) for Chromium. Regular API routes are unaffected.

### 11.3 Font Strategy

Fonts are base64-inlined into HTML templates at build time (not fetched at render time). This eliminates network fetch failures on cold start. A build script reads font files from Supabase storage and generates a CSS file with @font-face declarations using base64 data URLs. For presets (Playfair Display, Inter, Merriweather, Source Sans), the base64 CSS is pre-generated and bundled. For custom parish fonts, the CSS is generated on first use and cached.

## 12. Section: Caching and Performance

### 12.1 Cache Strategy

Generated PDFs are cached in Supabase storage with a content-based key:
- `{parish_id}/setlists/{occasion_code}_{ensemble}_{hash}.pdf`
- `{parish_id}/worship-aids/{occasion_code}_{hash}.pdf`

The hash is computed from the setlist content (song IDs + positions). When the setlist changes, the hash changes, and the old cache is invalid.

### 12.2 Cache Invalidation and Cleanup

When a song assignment changes in the planner grid:
1. Recompute the content hash for the affected mass event
2. If hash differs from cached version, mark as "outdated" in the UI
3. After debounce, auto-regenerate if the setlist is still complete

**Cleanup policy**: Keep the latest 2 PDFs per occasion per parish. Purge files older than 30 days. Run cleanup via Vercel Cron (weekly, Sunday midnight). The cron lists all files in the parish's storage prefix and deletes those exceeding the retention policy.

### 12.3 Mobile View Caching

The lyrics-only web page is server-rendered (Next.js SSR or ISR) with a 1-hour revalidation. Changes to the setlist trigger on-demand revalidation via `revalidatePath`.

## 13. Section: Error Handling and Resilience

### 13.1 Generation Pipeline Failures

| Failure | Behavior |
|---------|----------|
| Chromium fails to launch | Retry once. If still fails, return error to client with "Generation temporarily unavailable, try again in a minute." |
| Font loading times out | Proceed with system fallback fonts. Flag the PDF as "generated with fallback fonts" in the mass event record. |
| Reprint PDF fetch fails (network/404) | Skip that reprint. Insert a "Sheet music unavailable for [Song Title]" placeholder page. Log the failure. Continue assembly. |
| Reprint PDF is corrupt/zero-bytes | Same as fetch failure: skip and placeholder. |
| Cover image missing | Fall back to gradient cover using the liturgical season color. |
| Puppeteer render exceeds timeout | Return partial result if cover was already rendered. Otherwise return error. |
| pdf-lib assembly fails | Return error. This is rare and indicates a code bug, not a data issue. |
| Song has no CONG, no GIF, no LYR resource | Show title + composer only (no sheet music, no lyrics) in the worship aid. Director sees a warning in generation status. |

### 13.2 API Route Authentication and Rate Limiting

The `/api/generate/*` routes require authentication. Only parish admins or directors (role = "owner" or "admin" in parish_members) can trigger generation. Check via the existing Supabase auth middleware.

**Rate limiting**: Add a simple per-parish rate limit (max 10 generations per hour) using a counter in the mass_events table or a dedicated rate_limits table. This prevents runaway regeneration loops and protects Vercel function budget.

The `/wa/[slug]` mobile lyrics route is public (no auth) but access-controlled via HMAC-signed slug and 7-day time window.

## 14. Section: Testing Strategy

### 14.1 Unit Tests
- `reprint-resolver.ts`: Test tag filtering (CONG vs CC), fallback chain (PDF > GIF > lyrics > title-only), missing resource handling
- `cover-resolver.ts`: Test occasion code matching, gradient fallback, missing image handling
- `template-engine.ts`: Test CSS variable injection, layout preset switching, data binding
- `pdf-assembler.ts`: Test page ordering, multi-page reprint handling, header overlay placement

### 14.2 Integration Tests
- Full setlist generation: mock Puppeteer, verify PDF bytes are non-empty and correct page count
- Full worship aid generation: with real Supabase data (test parish), verify cover + reprints + text pages assemble correctly
- Auto-generation trigger: verify debounce, completeness detection, status updates

### 14.3 Visual Regression
- Store reference PDFs for a known setlist/worship aid
- On CI, generate the same documents and compare page count, file size within 10%, and first-page screenshot (via pdf-to-image) against reference
- Flag visual regressions for manual review

### 14.4 Puppeteer Smoke Test
- Deploy test: after Vercel deploy, hit `/api/generate/setlist` with test data, verify 200 response with valid PDF content-type and non-zero content-length
- Runs as a post-deploy check, not on every commit

## 15. Build Sequence

Order of implementation, with each section building on the previous:

1. **Data layer migration** (switch to v2, add tables) - foundation everything else needs
2. **PDF rendering engine** (Puppeteer wrapper, pdf-lib assembler, template engine) - core infrastructure
3. **Setlist/Menu generator** (simpler document, proves the pipeline works)
4. **Worship Aid generator** (complex assembly, builds on proven pipeline)
5. **Auto-generation trigger** (wires generation into the planner grid workflow)
6. **Parish brand config** (UI for customization, can use hardcoded St. Monica values until this ships)
7. **Cover art management** (St. Monica migration + upload UI)
8. **Mobile lyrics-only view** (separate from PDF pipeline, can ship independently)

Sections 1-4 are the critical path. Sections 5-9 are polish that can ship incrementally.
9. **Error handling and testing** (can be added incrementally alongside each section)
