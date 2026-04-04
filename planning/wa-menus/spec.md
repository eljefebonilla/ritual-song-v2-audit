# Ritual Song v2 - Worship Aid & Menu Generator System

## Context
We're building two auto-generated deliverables for Ritual Song v2 (a church music ministry SaaS app):

1. **Setlist/Menu** - For musicians and choir members. Per-ensemble, per-Mass time. Currently hand-built in Apple Pages weekly.
2. **Worship Aid** - For assembly (online viewers). Cover page + sheet music reprints + lyrics. Currently hand-built in Pages.

Both need to look BETTER than what a human can do. Layout options over manual editing. Must scale to other parishes beyond St. Monica.

## Codebase
- Repo: ~/Dropbox/RITUALSONG/ritualsong-app/ (Next.js, Supabase, deployed on Vercel)
- 3,158 songs in `songs` table, 2,006 with catalog numbers
- 11,877 OCP resources in `song_resources_v2` table (sheet music PDFs, lyrics, audio) - scraped from Breaking Bread + Spirit & Song
- App currently reads from `song_resources` (v1, only 4 rows) - needs to switch to v2
- `song-resources` Supabase storage bucket has the actual PDF files (verified, serving correctly)
- 870 song folders in Monica Music Master (local Dropbox, READ-ONLY, never delete)
- 1,415 worship aid cover images across 6 liturgical cycles (organized by occasion code like "260322 05LENT_A")
- SMPREP brand assets: three-cross logo (SVG/PNG), Eidetic Neo font (4 weights), Minion Pro font (10 weights)

## Resource Types in song_resources_v2
- CC (Choral/Cantor sheet music) - 748 files
- CONG (Congregational sheet music PDF) - 1,420 files
- CONG GIF (Congregational sheet music GIF) - 1,408 files
- GTR (Guitar accompaniment) - 1,419 files
- INST (Instrumental accompaniment) - 998 files
- KBD (Keyboard accompaniment) - 1,418 files
- LYR (Song lyrics) - 2,468 files
- Audio recordings - 1,387 files

## Technical Decisions Already Made
- **Format**: HTML/CSS templates rendered to PDF via headless browser (Puppeteer). NOT react-pdf (too limited), NOT Apple Pages (not scalable).
- **Why**: Full CSS control (flexbox, grid, @font-face, image compositing), same HTML serves as web preview and mobile lyrics view, layout options implemented as CSS custom properties.
- **Customization**: Directors pick layout presets (Classic, Modern, Minimal) and parish brand config. Manual editing is secondary to layout options.
- **Multi-parish**: Each parish uploads logo + picks color palette + picks layout preset. AI-generated cover art option for parishes without photo libraries.
- **St. Monica specific**: Three-cross logo, Eidetic Neo + Minion Pro fonts, 1,415 cover photos

## Deliverable 1: Setlist/Menu (for musicians)
- Data source: planner grid (songs, positions, personnel, ensemble)
- One PDF per ensemble per Mass time
- SMPREP branded header with logo, occasion name, date, ensemble, Mass time
- Song table: position labels, titles, composers, hymnal numbers, keys
- Personnel section: assigned musicians by role
- Safety song section

## Deliverable 2: Worship Aid (for assembly, online viewing)
- Cover page: liturgical photography (from 1,415 cover library, matched by occasion code) + text overlay with SMPREP branding
- Sheet music pages: pull congregational reprints from song_resources_v2, apply uniform branded header overlay (hide original title, add consistent styling)
- Readings integration: First Reading, Psalm Response (highlighted box), Second Reading, Gospel
- Order of Mass structure
- Exportable PDF for sharing
- Lyrics-only mobile web view (responsive HTML, not PDF)

## Deliverable 3: Parish Brand Config System
- Database table for parish branding: logo, fonts, colors, layout preset, cover style
- Upload UI for logo
- Color palette picker (presets + custom)
- Layout preset selector with live preview
- AI cover art generation option (for parishes without photo libraries)
- Style presets: "Cathedral" (serif, gold), "Modern" (sans, minimal), "Warm" (earthy tones)

## Key Files to Modify
- src/lib/supabase/songs.ts (switch from song_resources to song_resources_v2)
- src/components/library/ResourceLink.tsx (already handles PDF preview)
- src/app/api/recommendations/[occasionId]/route.ts (resources integration)
- src/components/setlist/pdf/ (replace react-pdf with Puppeteer HTML templates)
- src/app/admin/setlist/[massEventId]/print/page.tsx (setlist print page)
- src/tools/onboarding/types.ts (parish brand config)
- New: src/lib/worship-aid-generator.ts
- New: src/lib/menu-generator.ts
- New: src/templates/ (HTML/CSS templates for both deliverables)
- New: src/app/api/generate/ routes for PDF generation
- New migration for parish_brand_config table

## Constraints
- Monica Music Master is READ-ONLY - never delete anything
- St. Monica's SMPREP brand assets are specific to them, not hardcoded for all parishes
- Worship aid covers use naming convention YYMMDD OccasionCode (maps to liturgical calendar)
- Must work on Vercel (serverless) - Puppeteer needs @sparticuz/chromium for Lambda/serverless
- Layout options are the PRIMARY way to customize, manual editing is secondary

## Key Discoveries from This Session
- `song_resources_v2` has 11,877 rows (all ocp_bb source) with actual PDFs in Supabase storage
- `song_resources` (v1) has only 4 rows - app needs to switch to v2
- Local OCP scrape files at ~/Desktop/OCP Fresh Resource Files/ (11,266 files organized by type)
- Monica Music Master at ~/St Monica Dropbox/Jeff Bonilla/Monica Music Master/_Resources/Music/ has 870 song folders with OCP reprints, custom arrangements, psalms, mass parts
- Worship Aid Covers at ~/St Monica Dropbox/Livestream Mass Media/Digital Worship Aids/Worship Aid Covers/ has 1,415 images across 6 liturgical cycles
- Cover naming convention: YYMMDD OccasionCode (e.g., "260322 05LENT_A") maps to liturgical calendar
- Each song folder in Monica Music Master has subfolders: OCP/ (publisher reprints), OCTAVO/ (choir scores), STMO REHARMS/ (custom arrangements)
- OCP reprints include WA.gif (worship aid images), LS.pdf (lead sheets), KBD.pdf (keyboard), CHOIR.pdf (choral), INST.pdf (instrumental)
- Existing react-pdf components (SetlistPDF.tsx, WorshipAidPDF.tsx) need to be replaced with Puppeteer HTML template approach
- Parish brand config needs to support: logo upload, font selection, color palette, layout preset, cover style
- Other parishes need ability to upload their own assets OR use AI-generated alternatives
- Lyrics-only mobile view should be a web page (not PDF) for responsive viewing
