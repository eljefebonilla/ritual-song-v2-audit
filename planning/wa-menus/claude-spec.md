# Synthesized Specification: Worship Aid & Menu Generator

## Overview
Build an auto-generation system for two publication-quality documents in Ritual Song v2 (a Next.js/Supabase church music ministry SaaS app deployed on Vercel):

1. **Setlist/Menu**: Per-ensemble, per-Mass-time document for musicians and choir members
2. **Worship Aid**: Cover page + sheet music reprints + readings for the assembly (online viewers)

Both must look better than hand-built Apple Pages documents. Both must scale to any parish, not just St. Monica. Layout customization happens through presets and options, not manual document editing.

## Data Layer

### Songs Database
- 3,158 songs in `songs` table with metadata (title, composer, category, functions, scripture_refs, topics, liturgical_use, catalogs)
- 2,006 songs have catalog numbers (bb2026: 141, gather4: 91, spiritSong: 59, voices: 28, aahh: 24, novum: 15)

### Resources (Critical: Must Switch to V2)
- `song_resources` (v1): 4 rows. App currently reads from this table. MUST switch.
- `song_resources_v2`: 11,877 rows. All from OCP Breaking Bread scrape. Contains:
  - CC (Choral/Cantor sheet music): 748 PDFs
  - CONG (Congregational sheet music): 1,420 PDFs + 1,408 GIFs
  - GTR (Guitar accompaniment): 1,419 PDFs
  - INST (Instrumental accompaniment): 998 PDFs
  - KBD (Keyboard accompaniment): 1,418 PDFs
  - LYR (Song lyrics): 2,468 text files
  - Audio: 1,387 recordings
- Storage bucket `song-resources` has actual files, verified serving

### Cover Art Library
- 1,415 images across 6 liturgical cycles (Cycle A/B/C x 2 years each)
- Organized by occasion code: YYMMDD OccasionCode (e.g., "260322 05LENT_A")
- Located at: ~/St Monica Dropbox/Livestream Mass Media/Digital Worship Aids/Worship Aid Covers/
- Need to upload to Supabase for app access

### Brand Assets (St. Monica specific)
- Three-cross SMPREP logo: SVG and PNG variants (white, green, animated)
- Eidetic Neo font: 4 weights (Black, Small, Omni, Fracture)
- Minion Pro font: 10 weights (Regular through Bold Condensed Italic)
- Parish name in lowercase: "st. monica catholic community"

### Supplemental Local Assets (READ-ONLY)
- 870 song folders at ~/St Monica Dropbox/Jeff Bonilla/Monica Music Master/_Resources/Music/
- Each folder contains: OCP/ reprints, OCTAVO/ choir scores, STMO REHARMS/ custom arrangements
- Psalms organized by number in _PSALMS/ subfolder
- Mass parts organized by liturgical function in _Mass Parts/ subfolder

## Deliverable 1: Setlist/Menu

### Purpose
Document for musicians and choir members showing what to play/sing at a specific Mass.

### Content
- Parish branding (logo, name)
- Occasion name, date, Mass time, ensemble name
- Song table: liturgical position, title, composer, hymnal number, key
- Personnel assignments by role
- Safety song section
- Choir label

### Variants
- **Per-ensemble per-Mass-time** (default): one document per ensemble per Mass, matching current workflow (e.g., "250727_0930 17OTC_Generations")
- **Combined weekend view** (secondary): all ensembles on one document with sections

### Sheet Music for Musicians
- Choral/Cantor (CC) reprints for musicians, NOT congregational
- Link or embed based on director preference

## Deliverable 2: Worship Aid

### Purpose
Publication for the assembly viewing online. Combines cover art, sheet music, readings, and order of Mass into one exportable document.

### Content Structure
1. **Cover page**: Full-bleed liturgical photography + parish branding overlay + occasion name + date
2. **Order of Mass pages**: Readings (First Reading, Psalm Response in highlighted box, Second Reading, Gospel) interspersed with song reprints at correct liturgical positions
3. **Sheet music reprints**: Congregational versions by default (melody line for assembly singing). Pulled from `song_resources_v2` where tag = CONG.

### Header Overlay Options
- **Default**: Branded banner ABOVE each reprint page (original title stays visible)
- **Toggle**: Replace original header area with uniform branded text (white-out + overlay)

### Cover Image Sources (priority order)
1. Parish's uploaded cover art (persists per occasion across 3-year cycle)
2. Gradient + liturgical season color (instant, free, always available)
3. AI-generated liturgical art (premium option, costs tokens)

### Mobile Lyrics-Only View
- Responsive web page (not PDF)
- Public but time-limited URL (7 days around Mass date, then expires)
- Shareable via text/QR code in bulletin
- Shows: occasion name, song titles with lyrics, psalm response, readings

## Deliverable 3: Parish Brand Config

### Database Schema
- Parish logo (uploaded to storage)
- Primary/secondary/accent colors (from presets or custom hex)
- Font selections (from presets: serif, sans, slab; or upload custom)
- Layout preset (Classic/Cathedral, Modern, Warm/Minimal)
- Cover style preference (photo, gradient, AI art)
- Default header overlay mode (banner vs replace)

### Style Presets
- **Cathedral**: Serif fonts, gold accents, formal spacing, traditional feel
- **Modern**: Sans-serif, clean lines, minimal decoration
- **Warm**: Earthy tones, friendly typography, softer layout

### For Other Parishes
- Upload logo or pick from generic cross/church icon set
- Pick color palette from presets or enter custom colors
- Pick layout preset with live preview
- Upload cover art per occasion, or use gradient/AI fallback

## Generation Behavior

### Trigger
- Auto-generate draft when setlist is complete (all required positions filled)
- Director can regenerate anytime after changes
- Always shows latest version
- Cache generated PDFs in Supabase storage: `{parish}/{occasion}/{ensemble}/{content-hash}`

### Architecture
- **Text/cover pages**: HTML/CSS templates rendered to PDF via Puppeteer (puppeteer-core + @sparticuz/chromium on Vercel serverless)
- **Sheet music assembly**: pdf-lib merges cover PDF + music reprint PDFs + text PDF (preserves vector quality)
- **Mobile view**: Same HTML template rendered as responsive web page
- CSS custom properties for theming (layout presets = different CSS variable sets)

## Constraints
- Monica Music Master is READ-ONLY
- St. Monica brand assets are NOT hardcoded for all parishes
- Must work on Vercel serverless (Node.js runtime, not edge)
- Puppeteer needs 1-2GB memory, cold start 1-5 seconds
- Layout options are PRIMARY customization, manual editing is SECONDARY
- No em dashes in any generated content
