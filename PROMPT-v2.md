# Ritual Song v2.0 — Upgrade Prompt

## Context
Ritual Song is a full-stack liturgical music planning app for St. Monica Music Ministry. Built with Next.js 16, React 19, TypeScript, Supabase, Tailwind v4, deployed on Vercel. Currently v1.18.1 with 30+ routes, 2,660 songs, 350+ occasion data files, 5 ensembles, and a persistent audio player with pitch/tempo shifting.

**Codebase:** `~/Dropbox/RITUALSONG/ritualsong-app/`
**Tracking:** `~/Desktop/Claude/Tools/mission-control/tracking/ritualsong-v2/features.json`
**Deploy:** Vercel auto-deploy from `eljefebonilla/stmonica-music-ministry`

## What This Prompt Covers
6 phases, 28 binary-evaluated steps. Each phase can be executed as an independent session. Phases are ordered by dependency (cleanup before design, design before features).

---

## Phase 0: Critical Cleanup (5 steps)

Execute first. These are prerequisite fixes that unblock everything else.

### P0-01: Remove xlsx dependency
`xlsx` v0.18.5 has CVE-2023-30533 (prototype pollution). Grep the `src/` directory to confirm it is not imported in any app code. If only used in scripts, move to devDependencies or remove entirely. Run `npm audit` to confirm resolution.

### P0-02: Add .env.example
Create `.env.example` documenting all 10 environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_ACCESS_CODE`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

### P0-03: Auto-read version from package.json
The sidebar version string in `Sidebar.tsx` is hardcoded. Read version from `package.json` at build time (import or Next.js env). Search for `text-[9px] text-stone-500` to find the location.

### P0-04: Centralize localStorage keys
Create `src/lib/storage-keys.ts` with all `rs_*` key constants. Known keys:
- `rs_access`, `rs_view_mode`, `rs_hidden_nav`, `rs_nav_order`
- `rs_hidden_weeks`, `rs_hide_past_weeks`, `rs_hide_mass_parts`
- `rs_hide_readings`, `rs_hide_synopses`
- `rs-player-speed`, `rs-player-pitch`, `rs-player-volume`
Replace all raw string literals in components with imports from this file.

### P0-05: Replace dynamic require() in getOccasion()
`src/lib/data.ts` line ~36 uses synchronous `require()` to load per-occasion JSON files. Replace with `fs.readFileSync` + `JSON.parse` or a static import map. This pattern is incompatible with edge runtimes.

---

## Phase 1: Calendar V2 Promotion (5 steps)

Jeff prefers Calendar V2. Promote it to the primary calendar and retire V1.

### P1-01: Promote V2 to /calendar
Move `CalendarV2Shell` to render at `/calendar`. Either archive V1 at `/calendar/legacy` (if any users depend on the month grid view) or remove it entirely. Update sidebar nav links.

### P1-02: Dynamic liturgical year
`getSeason()` in `CalendarV2Shell.tsx` (lines 15-25) has hardcoded 2025-2026 season boundary dates. Replace with a function that computes the liturgical year from First Sunday of Advent (4th Sunday before Dec 25). Use the existing `liturgical_days` Supabase table or `usccb-*.json` files as reference, but the season boundaries themselves must be calculated, not hardcoded.

### P1-03: Migrate V1 admin features
Calendar V1 has: event create/edit (EventEditor slide panel), week hide/show (localStorage toggle). Ensure V2 has equivalent or better versions. V2 already has `EventCreatorModal` but may need the edit flow.

### P1-04: Calendar visible to all roles
V2 is currently admin-only (linked only in admin sidebar section). Move it to the main nav. Admin features (event editing, staffing filters) should be conditionally rendered based on role, not route-gated.

### P1-05: Remove V1 dead code
After V2 is promoted and V1 features migrated: delete `src/components/calendar/` directory and `src/lib/calendar-utils.ts` (if only used by V1). Remove the `/calendar-v2` route (now at `/calendar`).

---

## Phase 2: Design System (5 steps)

Establish a documented design system and apply it consistently.

### P2-01: Generate design.md
Use Peekaboo MCP to screenshot the 5 key pages (dashboard, calendar, library, occasion detail, planner). Run `/design generate` to produce `design.md` with: color tokens, typography scale, spacing system, component patterns, liturgical color palette, and the parish brand (gold #B8A472, burgundy #800000).

### P2-02: Audit and fix violations
Run `/design audit` against the generated `design.md`. Fix all violations: hardcoded hex values in `occasion-helpers.ts` (COMMUNITY_BADGES), `calendar-utils.ts`, and any component using inline color strings. All colors should flow from CSS custom properties in `globals.css` or Tailwind theme tokens.

### P2-03: Stitch redesign
Create a Stitch project "Ritual Song v2" with screens for: dashboard, calendar (V2), song library, occasion detail, and planner grid. Use the parish brand colors and the liturgical season palette. Iterate on visual quality before applying.

### P2-04: Apply Stitch designs
Use `/stitch apply [screen]` to translate each Stitch screen to the codebase. Verify with `/design audit` after each application. Key areas to improve: dashboard card hierarchy, library search UX, occasion detail reading flow.

### P2-05: Fix overflow:hidden
Remove `overflow: hidden` from `html, body` in `globals.css`. Refactor AppShell to use natural document scroll where possible. Test on iOS Safari (100vh issue). Verify: sidebar still fixed, media player still sticky bottom, planner grid still scrolls independently.

---

## Phase 3: Accessibility (4 steps)

### P3-01: ARIA labels
Audit all `<button>` and `<a>` elements that contain only SVG icons. Add `aria-label` to each. Priority: sidebar nav icons (when collapsed), media player controls, planner cell action buttons, song card action buttons. Run accessibility skill to verify.

### P3-02: Keyboard navigation in planner
The drag-copy planner grid is mouse-only. Add keyboard support: Tab between cells, Enter to open cell editor, arrow keys for navigation within the grid, a keyboard alternative to drag-copy (e.g., Ctrl+C / Ctrl+V on focused cells).

### P3-03: Focus trapping
Modals and slide-in panels (EventEditor, song search, filter panels) need focus trapping. When open, Tab should cycle within the panel. Escape should close it. Consider a lightweight focus-trap utility rather than a full library.

### P3-04: Color contrast
Run the accessibility skill's color contrast checker. Liturgical season colors (especially Easter white/gold text on light backgrounds, Ordinary green on dark) are likely contrast risks. Fix any failures while preserving the liturgical color identity.

---

## Phase 4: New Features (4 steps)

These are features already spec'd in memory. Build them.

### P4-01: Gospel Acclamation compound slot
**Spec:** Memory file `ritualsong.md`, section "Compound Liturgical Slots". The GA row in occasion detail should show: (1) the refrain setting (song from library), (2) the verse text and scripture citation, (3) separate audio players for refrain and verse recordings. Model after the existing psalm compound slot pattern. Use `gospelAcclamation` field on WorshipSlot. `OccasionResource.subcategory` distinguishes "refrain" vs "verse" vs "combined" audio.

### P4-02: Enriched Song Index
**Spec:** Memory file `enrichment.md`. Cross-publisher metadata from 6 catalogs. Add columns to songs table: `scripture_refs` (JSONB array), `topical_tags` (text array), `tune_name` (text), `meter` (text). Build extraction pipeline targeting 500+ songs. This powers better recommendations and search filtering.

### P4-03: Editable planning notes
User-requested feature (noted in memory as "pending"). Add a dynamic textarea to occasion detail pages that saves to `custom_worship_slots` in Supabase. Should auto-save on blur, expand with content, and persist across sessions. Per-admin (not shared).

### P4-04: Sheet music playback integration
**Spec:** Memory file `project_sheet_music_pipeline.md`. Pipeline: PDF -> SmartScore -> Dorico -> music21 -> SoundSlice/ABC notation. For v2.0, implement at minimum: one proof-of-concept song with interactive ABC notation rendered inline, playable from the song detail view. This validates the pipeline for broader rollout.

---

## Phase 5: Quality Gates (4 steps)

### P5-01: Test setup
Install Vitest. Write tests for the 5 most critical pure functions:
1. `recommendations.ts` — scoring algorithm produces expected rankings for a known occasion
2. `psalm-matching.ts` — correct psalm identified for a given lectionary citation
3. `duplicate-detection.ts` — known duplicates detected, non-duplicates excluded
4. `getSeason()` — returns correct season for dates across the full liturgical year
5. `getOccasion()` — returns correct data for a known occasion ID

### P5-02: Supabase type generation
Run `supabase gen types typescript --project-id <id>` to generate `src/lib/supabase/database.types.ts`. Replace all `Record<string, unknown>` casts in Supabase query results with proper typed interfaces. Verify TypeScript compiles with zero errors.

### P5-03: Web quality audit
Run the `web-quality-audit` skill against the deployed app. Fix all Critical issues. Run `core-web-vitals` skill to verify LCP, INP, CLS are all green. Document results.

### P5-04: External code review via PAL
Use PAL MCP (`mcp__pal__codereview`) to review the 3 most complex files:
1. `recommendations.ts` (scoring algorithm)
2. `PlannerShell.tsx` (drag-copy, multi-cell state)
3. `CalendarV2Shell.tsx` (after P1 changes)

Fix any Critical findings. Document the review results.

---

## Execution Strategy

Each phase is a single session. Use agent swarms per CLAUDE.md:

| Phase | Agents | Isolation |
|-------|--------|-----------|
| P0 | 3-4 execution agents (grouped by file proximity) + 1 review | No worktree needed |
| P1 | Plan (1) + Execute (3-4) + Review (1) | Worktree recommended |
| P2 | Sequential: screenshot -> /design -> /stitch -> apply -> audit | Manual review gates |
| P3 | 2-3 execution agents per step + accessibility skill verification | No worktree |
| P4 | Each feature is independent; parallel worktrees for P4-01 through P4-04 | Worktree per feature |
| P5 | Sequential: tests first, then types, then audit, then PAL review | No worktree |

**Version bumps:** P0 = v1.19.0, P1 = v1.20.0, P2 = v1.21.0, P3 = v1.22.0, P4 = v2.0.0, P5 = v2.0.1.

## Notes
- Jeff prefers Calendar V2 over V1. This is confirmed.
- The app has zero existing tests. P5-01 is foundational.
- The `song-library.json` fallback pattern is intentional and should be preserved (Supabase outage resilience).
- Holy Week is imminent. If any phase touches occasion data for Holy Week/Triduum, verify those pages still render correctly.
- Supabase is shared with Mission Control. Monitor usage limits during heavy migration work.
