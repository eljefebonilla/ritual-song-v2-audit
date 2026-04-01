# Ritual Song v2.0 — The Spec

**2026-03-31 | v1.19.1 → v2.0.0**
**https://stmonica-music-ministry.vercel.app**
**Next.js 16 / React 19 / TypeScript / Supabase / Tailwind v4 / Vercel**

---

> **The short version:** Ritual Song is a liturgical music planning app that currently serves St. Monica but is architected to serve every Catholic parish in America. This spec covers 80 features across 13 tiers, informed by 8 Gemini Deep Research reports, Jeff's complete product vision, and Arielle's operational knowledge dump. It's a missal meets Linear meets Spotify. No one has built this. We're building it.

---

## Table of Contents

| Section | What's in it |
|---------|-------------|
| **1. Current State** | 38 routes, 15 component dirs, design tokens, layout model, data layer |
| **2. Completion Status** | What's done (P0-P1), what's not, v2.0 scope boundary |
| **3. Design Vision** | Philosophy, visual direction, typography, known problems |
| **4. Design System** | Color tokens, spacing, component patterns, font strategy |
| **5. Page Redesign Specs** | Per-page: dashboard, calendar, library, occasion, planner, sidebar, player, today, auth |
| **6. Accessibility** | ARIA, keyboard nav, focus trapping, color contrast |
| **7. New Features (Original)** | GA compound slot, enriched index, planning notes, sheet music POC |
| **8. V1 Dead Code** | What's safe to delete, what needs extraction first |
| **9. Quality Gates** | Vitest, Supabase types, web audit, PAL review |
| **10. Execution Order** | 9-session plan with version bumps |
| **11. Brain Dump** | Jeff's complete vision: 18 subsections, scalability to portals |
| **12. Arielle Braindump** | Operational knowledge: naming, resources, scheduling, forScore, ProPresenter |
| **13. Visual Issues** | 7 bugs from screenshots with actions |
| **14. Feature Inventory** | 80 items across 13 tiers, deduplicated |
| **15. Research Findings** | 8 Gemini Deep Research reports: design tools, scheduling, licensing, wedding, funeral, practice tools, SaaS, workflows |
| **16. AI Agent Architecture** | Runtime patterns, tool servers, skills, sub-agents, phased implementation |
| **17. Recommendations** | 20 decisions with positions taken and rationale |

---

## 1. Current State Inventory

### 1.1 Routes (38 total)

| Category | Route | Purpose |
|----------|-------|---------|
| **Core** | `/` | Dashboard: season grid, upcoming occasions, synopses |
| | `/calendar` | Calendar V2 (just promoted): infinite scroll, liturgical days, USCCB data |
| | `/calendar-v2` | Redirect to `/calendar` |
| | `/today` | Today view: what's happening, cantor briefing |
| | `/day/[date]` | Day detail for any date |
| **Library** | `/library` | Song library: 2,660 songs, search, filter, explorer |
| | `/library/psalms` | Psalm browser with lectionary matching |
| | `/library/gospel-acclamations` | GA browser |
| | `/library/mass-parts` | Mass parts by setting |
| **Planning** | `/planner` | Drag-copy grid: 12 song rows x N weeks |
| | `/planner/compare` | Side-by-side occasion comparison |
| | `/planner/triduum` | Holy Week special planner |
| | `/occasion/[id]` | Occasion detail: readings, slots, recommendations, resources |
| | `/season/[id]` | Season overview with occasion cards |
| **Liturgies** | `/liturgies` | Hub: 8 sacramental/devotional types |
| | `/liturgies/[type]` | Individual liturgy planning page |
| **Admin** | `/admin/booking` | Booking grid for mass events |
| | `/admin/members` | Member management |
| | `/admin/setlist/[id]` | Setlist editor per mass event |
| | `/admin/setlist/[id]/print` | Print-friendly setlist |
| | `/admin/duplicates` | Duplicate song review |
| | `/admin/psalm-gaps` | Missing psalm coverage |
| | `/admin/season-briefing` | Season prep overview |
| | `/admin/messages` | Messaging center |
| | `/admin/compliance` | GDPR/compliance dashboard |
| | `/admin/settings` | App settings |
| **Auth/Onboard** | `/gate` | Access code gate |
| | `/auth/login`, `/auth/signup` | Auth flows |
| | `/join`, `/join/[code]` | Invite join flow |
| | `/onboard` | New user onboarding wizard |
| | `/pending` | Pending approval holding page |
| **User** | `/profile` | User profile |
| | `/profile/compliance` | User compliance settings |
| | `/profile/emergency` | Emergency contact |
| | `/announcements` | Parish announcements |
| | `/choir` | Choir sign-up for masses |
| **Legal** | `/privacy`, `/terms` | Static legal pages |

### 1.2 Component Architecture

| Directory | Files | Purpose |
|-----------|-------|---------|
| `layout/` | AppShell, Sidebar, MediaPlayer | App chrome: viewport-locked, sidebar nav, persistent audio player |
| `calendar/` | 9 files | **V1 calendar (retiring)**: AgendaView, MonthView, WeekHeader, EventCard, etc. |
| `calendar-v2/` | 7 files | **V2 calendar (active)**: infinite scroll, USCCB liturgical data, event creator |
| `library/` | 14 files | Song library, search, filters, song explorer constellation, resource uploads |
| `music/` | 12 files | Occasion music: SlotList, SongSlot, OrderOfWorship, resource panel |
| `planner/` | 12 files | Planning grid, cell editor, recommendations, comparison, triduum |
| `admin/` | 3 files | Members, duplicates, compliance shells |
| `booking/` | 3 files | Booking grid, slot editor |
| `today/` | 2+ files | Today shell, cantor briefing card |
| `choir/` | 1+ files | Mass sign-up card |
| `ui/` | 1 file | LiturgicalDayBadge (shared) |
| `onboard/` | ? | Onboarding wizard steps |
| `comments/` | ? | Comment system |
| `setlist/` | ? | Setlist editor |

### 1.3 Design Tokens (current)

**globals.css @theme inline:**
```
--color-background: #fafaf9     (stone-50)
--color-foreground: #1c1917     (stone-900)
--color-sidebar: #1c1917        (stone-900)
--color-sidebar-text: #fafaf9   (stone-50)
--color-parish-gold: #B8A472    (brand)
--color-parish-burgundy: #800000 (brand)
--color-parish-charcoal: #3A3A3A (brand)
--font-sans: Trebuchet MS, Helvetica Neue
--font-serif: Garamond, Georgia
```

**Liturgical season colors (in both globals.css and liturgical-colors.ts):**
```
Advent:     #6B21A8  (purple-800)
Christmas:  #CA8A04  (yellow-600)
Lent:       #581C87  (purple-900)
Holy Week:  #7F1D1D  (red-900)
Easter:     #CA8A04  (yellow-600) — same as Christmas, needs differentiation
Ordinary:   #166534  (green-800)
Solemnity:  #991B1B  (red-800)
Feast:      #B91C1C  (red-700)
Rose:       #DB2777  (pink-600)
```

**Liturgical vestment colors (LITURGICAL_COLOR_HEX):**
```
Violet: #6B21A8   White: #D4A017   Red: #B91C1C
Green:  #166534   Rose:  #DB2777   Black: #1C1917
```

**Occasion color overrides:** 12 specific occasions (Gaudete, Laetare, Palm Sunday, Holy Thursday, Good Friday, Pentecost) with per-occasion hex values.

### 1.4 Layout Model

- `html, body`: `height: 100%; overflow: hidden` (viewport-locked)
- `AppShell`: `div.h-screen.overflow-hidden` wrapping sidebar + main
- `main`: `h-full overflow-auto md:ml-64` (scrollable content area)
- Sidebar: fixed left, 16rem (256px) on desktop, slide-over on mobile
- MediaPlayer: sticky bottom bar within main content area, 1,117 lines, handles audio + YouTube + pitch/tempo shifting + key transposition
- Full-screen pages (gate, auth, join, onboard, etc.) bypass AppShell

### 1.5 Data Layer

- **14 JSON data files** in `src/data/`: occasions, calendar, lectionary synopses, song library, USCCB 2026/2027, saints, catalogs, etc.
- **Supabase tables**: mass_events, booking_slots, ministry_roles, liturgical_days, songs (partial), custom_worship_slots, profiles, etc.
- **Fallback pattern**: JSON files serve as resilient fallback when Supabase is unreachable (intentional design)

---

## 2. Completion Status

### Phase 0: Critical Cleanup — COMPLETE (v1.19.0)
- [x] P0-01: xlsx CVE removed
- [x] P0-02: env.example created (renamed from .env.example to avoid Next.js auto-load)
- [x] P0-03: Auto-version from package.json
- [x] P0-04: localStorage keys centralized in storage-keys.ts
- [x] P0-05: Dynamic require() documented with Map cache

### Phase 1: Calendar V2 Promotion — MOSTLY COMPLETE (v1.19.1)
- [x] P1-01: V2 promoted to /calendar (done today, 2026-03-31)
- [x] P1-02: Dynamic liturgical year (liturgical-year.ts computes Easter/Advent algorithmically)
- [x] P1-03: V2 has EventCreatorModal with create/edit/delete (admin-gated via useUser)
- [x] P1-04: Calendar in main nav for all roles (admin features conditionally rendered)
- [ ] **P1-05: Remove V1 dead code** (blocked: SeasonAlert used by dashboard, calendar-utils shared)

### Phases 2-5: NOT STARTED

### v2.0 Scope Boundary

80 features. 13 tiers. Without a line in the sand, this becomes a fantasy document. Here's the line:

| Release | Scope | What ships |
|---------|-------|-----------|
| **v2.0** | Tiers 1-4 + original P2-P5 (items 69-75) | Bug fixes, design system, calendar/planner upgrades, accessibility, tests, V1 cleanup |
| **v2.1** | Tiers 5-6 | Song selection intelligence, occasion/season view fixes |
| **v3.0** | Tiers 7-9 + practice tools V2 | Wedding portal, funeral portal, Plan a Mass, SoundSlice integration |
| **v3.x** | Tiers 10-13 + practice tools V3 | Musician management, multi-parish, OSMD engine, ProPresenter, integrations |

Everything below v2.0 is the product roadmap. Everything AT v2.0 is what we're building now.

---

## 3. Design Vision

### 3.1 Design Philosophy

A missal meets Linear. Sacred content, power-user density, zero wasted pixels.

**Principles:**
1. **Liturgical color is information, not decoration.** Every season color, vestment color, and rank indicator carries meaning. The design system must treat these as a data visualization palette, not a theme.
2. **Density over whitespace.** Music directors are power users juggling 50+ occasions per season. Prefer information-dense layouts with clear hierarchy over airy marketing-style spacing.
3. **Serif for sacred, sans for utility.** Readings, occasion titles, and liturgical names use the serif stack (Garamond/Georgia). Controls, metadata, tags, and UI chrome use the sans stack (Trebuchet/Helvetica).
4. **Parish brand as accent, not primary.** Gold (#B8A472) and burgundy (#800000) appear in the sidebar, header, and brand moments. Liturgical colors dominate the content area.
5. **Progressive disclosure.** Show the minimum needed for scanning; expand on interaction. Occasion cards show title + date + season; click reveals readings, resources, recommendations.

### 3.2 Visual Direction

**Mood:** Warm parchment, not clinical white. Stone-50 (#fafaf9) breathes. Stone-200 (#e7e5e3) borders whisper. The sidebar (#1c1917) is the one dark anchor that makes everything else feel luminous.

**Universal Ombre Header:** Every page opens with a gradient wash that fades from the contextual color into the parchment background. This is the most unifying visual pattern in the app. Season pages get the liturgical color. Library gets parish gold. Funeral portal gets intentionally desaturated stone. The gradient communicates context before you read a word. Implementation: `bg-gradient-to-b from-[color-mix(in_srgb,var(--liturgical-theme),transparent_90%)] to-background`. Full per-page rules documented in DESIGN.md.

**Elevation model:**
- Level 0: Page background (#fafaf9)
- Level 1: Cards and panels (white #ffffff with 1px stone-200 border, subtle shadow-sm)
- Level 2: Modals and overlays (white with shadow-xl, stone-900/50 backdrop)
- Level 3: Popovers and tooltips (stone-900 bg, stone-50 text)

**Motion:** Almost none. Sidebar collapse, modal enter/exit, scroll-to-today. That's it. 150ms max. If an animation doesn't serve a spatial orientation purpose, it doesn't exist.

**Typography scale:**
| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `display` | 28px / 1.75rem | 300 light | Month headers in calendar |
| `heading-1` | 22px / 1.375rem | 600 semibold | Page titles |
| `heading-2` | 18px / 1.125rem | 600 semibold | Section headers, occasion titles |
| `heading-3` | 15px / 0.9375rem | 600 semibold | Card titles, subsections |
| `body` | 14px / 0.875rem | 400 regular | Default text |
| `body-sm` | 13px / 0.8125rem | 400 regular | Secondary text, metadata |
| `caption` | 11px / 0.6875rem | 500 medium | Tags, badges, timestamps |
| `micro` | 9px / 0.5625rem | 500 medium | Version string, least important metadata |

### 3.3 Known Design Problems

| Problem | Severity | Fix |
|---------|----------|-----|
| Easter and Christmas share #CA8A04 | High | Easter → #D97706 (amber-600). Two resurrection-level feasts can't wear the same outfit. |
| Hex values scattered across 4+ files | High | Single source of truth in globals.css `@theme`. Zero hex in components. |
| `overflow: hidden` on html/body | High | Remove it. Use per-section scroll. Fixes iOS Safari 100vh, anchor links, and native scroll. |
| No component patterns | Medium | Document consistent Tailwind class patterns for Badge, Card, Button, Modal, Input. Not extracted components yet, just documented patterns. |
| MediaPlayer is 1,117 lines | Medium | Visual-only improvements in v2.0. Internal refactor is a v2.1 task. Don't touch the engine during a design pass. |
| System fonts (Trebuchet/Garamond) | Low | Add Inter + Lora via `next/font/google`. System fonts as fallback. Zero layout shift. |

---

## 4. Design System

### 4.1 Color Tokens

All colors must flow from CSS custom properties in globals.css `@theme inline` block. Components reference Tailwind classes (e.g., `text-parish-gold`, `bg-advent`) or CSS vars. No raw hex in component files.

#### Brand Palette
| Token | Hex | Use |
|-------|-----|-----|
| `--color-parish-gold` | #B8A472 | Brand accent: sidebar logo, active nav highlight, premium moments |
| `--color-parish-burgundy` | #800000 | Brand accent: links, CTA buttons, admin actions |
| `--color-parish-charcoal` | #3A3A3A | Brand text: headings on light backgrounds |

#### Neutral Palette
| Token | Hex | Tailwind | Use |
|-------|-----|----------|-----|
| `--color-background` | #fafaf9 | stone-50 | Page background |
| `--color-foreground` | #1c1917 | stone-900 | Primary text |
| `--color-surface` | #ffffff | white | Card/panel background |
| `--color-border` | #e7e5e3 | stone-200 | Borders, dividers |
| `--color-muted` | #a8a29e | stone-400 | Placeholder, disabled text |
| `--color-subtle` | #f5f5f4 | stone-100 | Hover states, zebra stripes |
| `--color-sidebar` | #1c1917 | stone-900 | Sidebar background |
| `--color-sidebar-text` | #fafaf9 | stone-50 | Sidebar text |

#### Liturgical Season Palette
| Token | Hex | Season | Vestment parallel |
|-------|-----|--------|-------------------|
| `--color-advent` | #6B21A8 | Advent | Violet/Purple |
| `--color-christmas` | #CA8A04 | Christmas | White/Gold |
| `--color-lent` | #581C87 | Lent | Violet (deeper) |
| `--color-holyweek` | #7F1D1D | Holy Week | Red/Violet |
| `--color-easter` | #D97706 | Easter | White/Gold (amber-shifted) |
| `--color-ordinary` | #166534 | Ordinary Time | Green |
| `--color-solemnity` | #991B1B | Solemnities | Red/White |
| `--color-feast` | #B91C1C | Feasts | Red/White |
| `--color-rose` | #DB2777 | Rose Sundays | Rose |

#### Liturgical Vestment Colors (for day-level calendar data)
| Token | Hex | Use |
|-------|-----|-----|
| `--color-vest-violet` | #6B21A8 | Violet vestment days |
| `--color-vest-white` | #D4A017 | White vestment days (shown as gold for visibility) |
| `--color-vest-red` | #B91C1C | Red vestment days |
| `--color-vest-green` | #166534 | Green vestment days |
| `--color-vest-rose` | #DB2777 | Rose vestment days |
| `--color-vest-black` | #1C1917 | Black vestment days |

#### Semantic Colors
| Token | Hex | Use |
|-------|-----|-----|
| `--color-success` | #16a34a | Confirmed bookings, valid states |
| `--color-warning` | #d97706 | Needs attention, understaffed |
| `--color-error` | #dc2626 | Errors, declined, missing |
| `--color-info` | #2563eb | Informational, links |

### 4.2 Spacing System

Use Tailwind's default 4px grid. Key application-level spacing:

| Context | Value | Use |
|---------|-------|-----|
| Page padding | `p-4 md:p-6` | Consistent page-level breathing room |
| Card padding | `p-4` | Interior card spacing |
| Card gap | `gap-3` | Between cards in a grid/list |
| Section gap | `space-y-6` | Between major page sections |
| Inline gap | `gap-2` | Between inline elements (badges, chips, buttons) |
| Tight gap | `gap-1` | Between tightly coupled elements (icon + label) |

### 4.3 Component Patterns

These are NOT extracted React components (yet). They are documented Tailwind class patterns to apply consistently.

#### Card
```
bg-white border border-stone-200 rounded-lg shadow-sm
```
Hover state (if interactive): `hover:shadow-md hover:border-stone-300 transition-shadow`

#### Badge (liturgical)
```
inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium
bg-{season}-50 text-{season}-800 border border-{season}-200
```

#### Badge (status)
```
inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
```
Variants: `bg-green-50 text-green-700` (confirmed), `bg-amber-50 text-amber-700` (pending), `bg-red-50 text-red-700` (declined)

#### Button (primary)
```
px-4 py-2 rounded-lg bg-parish-burgundy text-white font-medium text-sm
hover:bg-parish-burgundy/90 transition-colors
```

#### Button (secondary)
```
px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm
hover:bg-stone-50 transition-colors
```

#### Button (ghost)
```
px-3 py-1.5 rounded-md text-stone-600 text-sm
hover:bg-stone-100 transition-colors
```

#### Modal
```
Backdrop: fixed inset-0 bg-stone-900/50 z-50
Panel: bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6
```

#### Slide Panel
```
fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-40
transform transition-transform duration-200
```

#### Input
```
w-full px-3 py-2 rounded-lg border border-stone-300 text-sm
focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold
placeholder:text-stone-400
```

### 4.4 Font Strategy

**Decision made:** Inter (sans) + Lora (serif) via `next/font/google`. Trebuchet and Garamond stay as fallbacks.

- **Inter:** UI chrome, navigation, data tables, metadata. The most legible sans-serif on screens at any size.
- **Lora:** Liturgical headers, occasion titles, readings, scripture citations. Warm serif with reliable rendering.
- **Load strategy:** `next/font/google` with `display: 'swap'`. Zero layout shift. Fonts cached after first load.

---

## 5. Page-by-Page Redesign Specs

### 5.1 Dashboard (`/`)

**Current state:** Season grid with occasion cards grouped by liturgical period. Uses `SeasonAlert` (from V1 calendar components), synopses, and upcoming event data. Functional but visually flat.

**Redesign goals:**
- Hero section: current liturgical day with vestment color band, today's readings summary, and "Jump to Planning" CTA
- Season progress: visual indicator showing where we are in the liturgical year (e.g., Lent Day 38 of 46)
- Upcoming events: next 7 days of calendar events pulled from V2 calendar data (replacing static occasion list)
- Quick actions: "Plan This Sunday", "View Triduum", "Song Explorer" cards
- Recent activity: last 5 planning changes (if change_log table exists)

**Components affected:**
- `src/app/page.tsx` (server component, data fetching)
- `SeasonAlert` — move from `components/calendar/` to `components/ui/` or inline into dashboard
- New: `DashboardHero`, `SeasonProgress`, `QuickActions` (or inline sections)

**Design notes:**
- The season grid (Advent, Christmas, OT I, Lent, etc.) is powerful. Keep it but improve card hierarchy.
- Each season card should show: season name (serif, heading-2), occasion count, color band on left edge matching season color, progress (X of Y planned).
- Current season should be visually elevated (larger, bordered with season color, shadow-md).

### 5.2 Calendar (`/calendar`)

**Current state:** V2 is live. Infinite scroll with month headers, day rows, liturgical USCCB data, mass events, booking counts. Filter panel for event types, ranks, vestment colors, staffing. Event create/edit modal for admins.

**Redesign goals:**
- Tighten vertical density: current day rows have generous spacing; compress for scanning
- Season color band: thin 3px left border on each day row, colored by liturgical season
- Today highlight: warm gold background stripe on today's row, auto-scroll on load
- Month headers: large serif display type ("MARCH 2026") with season name badge underneath
- Event cards within day rows: ensemble color dot, time, title, assigned count. Subtle, not boxy.
- Print stylesheet: clean single-column for printing upcoming weeks
- Keyboard nav: up/down arrow scrolls by day, Enter opens day detail

**Components affected:**
- `CalendarV2Shell.tsx` — layout and scroll behavior
- `DayRow.tsx` — individual day rendering
- `MonthHeader.tsx` — month section headers
- `CalendarV2Toolbar.tsx` — filter controls
- `CalendarV2FilterPanel.tsx` — advanced filters

**Design notes:**
- The V2 calendar already looks good (per Jeff's confirmation). Changes should be refinements, not overhauls.
- The ensemble dropdown, federal holiday toggle, and hide-past controls work well. Keep them.
- Consider adding a mini-map: a small month grid in the toolbar showing which days have events (dots), allowing quick jump navigation.

### 5.3 Song Library (`/library`)

**Current state:** Search bar + filter chips + alphabetical song list with SongCard components. Each card shows title, composer, publisher, category, audio play button if available. Song Explorer (constellation visualization) available when a date is selected.

**Redesign goals:**
- Search should feel instant: debounced input with result count
- Filter bar: horizontal scrollable chips for category, publisher, season, key. Active filters highlighted with count badge.
- Song cards: tighter layout. Title (bold) + composer on one line, publisher + number on second line, action buttons (play, details, add to plan) right-aligned.
- Song detail slide panel: improve reading flow. Group: metadata (top), resources/audio (middle), recommendations context (bottom).
- Mass Parts sub-library (`/library/mass-parts`): group by mass setting with expandable sections
- Psalm sub-library (`/library/psalms`): group by psalm number, show lectionary coverage

**Components affected:**
- `SongLibraryShell.tsx` — main shell
- `SongCard.tsx` — individual song display
- `SongDetailPanel.tsx` — detail slide panel
- `LibraryFilters.tsx` — filter controls
- `AlphabetJump.tsx` — alphabetical navigation

### 5.4 Occasion Detail (`/occasion/[id]`)

**Current state:** The core planning page. Shows readings (First, Psalm, Second, Gospel, GA), worship slot list with song assignments, recommendation engine, resource panel with audio players. This is the most complex and most used page.

**Redesign goals:**
- Lectionary header: occasion title (serif, large), date, season badge, vestment color dot, cycle year
- Readings section: collapsible, with scripture citations and synopsis logline visible by default
- Worship slot list: clear visual hierarchy. Each slot row shows: slot name (left), assigned song (center, clickable), recommendation chips (right, on hover/focus). Empty slots should have a subtle "Assign" CTA.
- Gospel Acclamation compound slot (P4-01): refrain setting + verse text + dual audio players
- Planning notes textarea (P4-03): persistent, auto-saving, per-admin
- Resource panel: tabbed or accordion (Audio, Documents, Links) instead of flat list
- Recommendation engine results: confidence score visualization (bar or dot scale, not just number)

**Components affected:**
- `src/app/occasion/[id]/page.tsx` — server data fetching
- `music/SlotList.tsx` — worship slot rendering
- `music/SongSlot.tsx` — individual slot
- `music/OccasionMusicSection.tsx` — top-level music section
- `music/OccasionResourcePanel.tsx` — resource display
- `music/OrderOfWorship.tsx` — order of worship view

### 5.5 Planner Grid (`/planner`)

**Current state:** Spreadsheet-style grid. Columns = weeks/occasions. Rows = liturgical slots (Gathering, Psalm, GA, Offertory, Holy Holy, etc.). Cells contain assigned songs with drag-copy between cells. Filter toolbar for synopses, readings, mass parts visibility.

**Redesign goals:**
- Freeze first column (slot names) on horizontal scroll
- Column headers: occasion title + date + season color band
- Cells: assigned song name with subtle background tint matching season. Empty cells show faint "+" on hover.
- Drag-copy visual feedback: ghost cell follows cursor, target cells highlight
- Comparison mode (`/planner/compare`): improve side-by-side readability
- Triduum planner (`/planner/triduum`): special layout for Holy Thursday, Good Friday, Easter Vigil (3 columns, shared resources row)
- Print: clean grid export for physical planning meetings

**Components affected:**
- `PlannerShell.tsx` — main shell (complex, drag-copy state management)
- `PlannerGrid.tsx` — grid rendering
- `GridCell.tsx` — individual cell
- `GridColumnHeader.tsx` — column headers
- `CellEditor.tsx` — cell editing popover
- `FilterToolbar.tsx` — display toggles

### 5.6 Sidebar

**Current state:** Dark sidebar (#1c1917) with icon + label nav items. Collapsible. Season-specific items appear contextually. Version string at bottom. Parish name + community badge.

**Redesign goals:**
- Active item: gold (#B8A472) left border accent + subtle gold text tint
- Season indicator: thin color band at the top of sidebar showing current season color
- Collapse behavior: icons only with tooltips on hover
- Mobile: full-width slide-over with backdrop, smooth 200ms transition
- Group visual separation: subtle divider between main nav, admin section, and season items

**Components affected:**
- `Sidebar.tsx` — 155+ lines, handles nav items, icons, collapse, ordering

### 5.7 Media Player

**Current state:** Sticky bottom bar. Handles audio files, YouTube embeds, pitch shifting, tempo control, key transposition, play queue. 1,117 lines.

**Redesign goals:**
- Compact mode (default): thin bar with play/pause, track title, progress bar, volume. 48px height.
- Expanded mode (click to expand): full controls including pitch, tempo, key transposition, queue
- YouTube mode: thumbnail + play inline, no separate expand
- Mobile: full-width bottom sheet with swipe-up for expanded controls
- Waveform visualization: optional, subtle progress indicator (not a full waveform, just a colored progress bar with the season color)

**Components affected:**
- `MediaPlayer.tsx` — the entire 1,117-line file. **Do not refactor in this phase.** Visual-only changes on the outer wrapper and layout. Internal logic stays.

### 5.8 Today View (`/today`)

**Current state:** Shows today's masses, cantor briefing card, assignments.

**Redesign goals:**
- Morning-briefing style: "Today is [liturgical day name], [vestment color]. You have [N] masses."
- Timeline layout: vertical timeline with mass events as nodes, showing time, ensemble, and assigned personnel
- Cantor briefing: prominent card with today's psalm, GA verse, and any special notes
- Quick link to each mass's setlist

### 5.9 Auth & Onboarding

**Current state:** Gate page (access code), login/signup, onboarding wizard with step animations.

**Redesign goals:**
- Gate: centered card with parish logo, gold accent, clean input. Warm and welcoming.
- Login/Signup: clean form, parish branding at top
- Onboarding: keep step wizard, improve visual polish. Each step card consistent with design system.

---

## 6. Accessibility Overhaul

### 6.1 ARIA Labels (P3-01)

**Audit targets:**
- Sidebar nav icons (when collapsed): each `<button>` or `<a>` with only SVG child needs `aria-label`
- Media player controls: play, pause, skip, volume, expand buttons
- Planner grid cells: action buttons (add, edit, copy)
- Song card buttons: play, details, add-to-plan
- Calendar toolbar: filter toggles, today button
- Modal close buttons: all `X` buttons need `aria-label="Close"`
- Mobile hamburger: already has `aria-label="Open menu"` (verified)

**Implementation:** Grep for `<button` and `<a` elements containing only `<svg`. Add `aria-label` to each. Run axe-core or accessibility skill to verify zero missing-label violations.

### 6.2 Keyboard Navigation (P3-02)

**Planner grid:**
- Tab between cells in reading order (left-to-right, top-to-bottom)
- Arrow keys for directional navigation within the grid
- Enter to open cell editor
- Escape to close cell editor
- Ctrl+C / Ctrl+V as keyboard alternative to drag-copy
- `role="grid"`, `role="row"`, `role="gridcell"` on the table structure

**Calendar:**
- Arrow keys to navigate between days
- Enter to expand day detail
- Escape to collapse

**Song library:**
- Arrow keys to navigate search results
- Enter to open song detail
- Escape to close detail panel

### 6.3 Focus Trapping (P3-03)

**Targets:**
- `EventCreatorModal` (calendar V2)
- `CellEditor` popover (planner)
- `SongDetailPanel` slide panel
- `SlotEditPopover` (occasion detail)
- Song search modal (library)
- `CalendarV2FilterPanel` (when open as overlay on mobile)

**Implementation:** Lightweight focus trap utility. When modal/panel opens: save previously focused element, move focus to first focusable child, trap Tab cycle within the container. On close: restore focus to saved element. Escape closes.

### 6.4 Color Contrast (P3-04)

**Known risks:**
- Easter white/gold text on light backgrounds
- Ordinary Time green on dark sidebar
- Rose (#DB2777) on light backgrounds may be fine, but verify
- Stone-400 (#a8a29e) muted text on stone-50 background (4.48:1 ratio, barely passes AA for normal text)
- Season badge text on season-50 light backgrounds (needs per-season verification)

**Testing:** Run the accessibility skill's contrast checker. Fix any WCAG AA failures (4.5:1 for normal text, 3:1 for large text and UI components) while preserving liturgical color identity. If a liturgical color fails contrast, darken it for text use while keeping the original for decorative elements (borders, badges backgrounds).

---

## 7. New Features

### 7.1 Gospel Acclamation Compound Slot (P4-01)

**Context:** The Gospel Acclamation has three parts: (1) a refrain (e.g., "Alleluia" setting from the music library), (2) a verse (scripture text, unique per Sunday), and (3) audio recordings for both. Currently these are partially handled but not unified in the UI.

**Spec:**
- In occasion detail, the GA row expands to show:
  - **Refrain line:** Song title from library (clickable to song detail), composer, audio play button
  - **Verse line:** Scripture citation, verse text, separate audio play button for verse recording
  - **Combined line (if available):** Single audio for the full GA
- Data model: `WorshipSlot.gospelAcclamation` field carries `{ title, composer?, verse? }`. `OccasionResource.subcategory` distinguishes `"refrain"` / `"verse"` / `"combined"` audio.
- Follow the existing psalm compound slot pattern in `SlotList.tsx`.

**Files to modify:**
- `music/SlotList.tsx` — routing logic for GA slot type
- New: `music/GospelAcclamationRow.tsx` (or extend existing pattern)
- `lib/types.ts` — ensure `gospelAcclamation` type is correct

### 7.2 Enriched Song Index (P4-02)

**Context:** Cross-publisher metadata from 6 catalogs. Adds scripture references, topical tags, tune names, and meter to the songs table, enabling better recommendations and search.

**Spec:**
- New columns on `songs` Supabase table:
  - `scripture_refs` (JSONB array of `{ book, chapter, verses? }`)
  - `topical_tags` (text array, e.g., `["mercy", "healing", "lent"]`)
  - `tune_name` (text, e.g., `"BEACH SPRING"`)
  - `meter` (text, e.g., `"87.87 D"`)
  - `languages` (text array, e.g., `["english"]`, `["spanish"]`, `["english", "spanish"]` for bilingual)
  - `ceremony_types` (text array, e.g., `["wedding"]`, `["funeral"]`, `["wedding", "funeral"]` for songs appearing in both portals)
- Extraction pipeline: process 6 publisher catalogs (OCP, GIA, WLP, etc.) to populate these fields for 500+ songs
- Library UI: new filter chips for scripture reference, topical tags, language (English/Spanish/Bilingual), and ceremony type (Wedding/Funeral)
- Recommendation engine: scripture_refs improve match scoring for occasions with known readings
- Song detail panel: show tune name, meter, scripture refs, topical tags in metadata section

**Files to modify:**
- Supabase migration: new columns
- `lib/recommendations.ts` — scoring boost for scripture matches
- `SongDetailPanel.tsx` — display new metadata
- `LibraryFilters.tsx` — new filter options
- Pipeline script: `scripts/enrich-songs.ts` (new)

### 7.3 Editable Planning Notes (P4-03)

**Context:** Music directors want to jot notes per occasion (e.g., "Fr. Mark prefers traditional Gloria", "Need extra cantor for this Mass"). These are personal per-admin, not shared.

**Spec:**
- Textarea on occasion detail page, below the music section
- Auto-saves to Supabase `custom_worship_slots` or a new `planning_notes` table on blur
- Expands with content (auto-resize textarea)
- Per-admin: uses authenticated user ID
- Persists across sessions
- Subtle styling: no border by default, shows border on focus. Placeholder: "Add planning notes..."

**Files to modify:**
- `src/app/occasion/[id]/page.tsx` — fetch existing notes
- New: `music/PlanningNotes.tsx` component
- API route: `src/app/api/planning-notes/route.ts` (or use existing custom_worship_slots)

### 7.4 Sheet Music Playback (P4-04)

**Context:** Pipeline: PDF → SmartScore OCR → Dorico → music21 → SoundSlice/ABC notation. For v2.0, deliver one proof-of-concept song with interactive notation.

**Spec:**
- One song gets ABC notation data stored in Supabase or a JSON file
- Song detail panel gains a "Sheet Music" tab/section
- Renders interactive notation using abcjs library (lightweight, 60KB)
- Playback: abcjs has built-in MIDI synthesis for basic playback
- Proof of concept validates the pipeline for broader rollout post-v2

**Files to modify:**
- `package.json` — add `abcjs` dependency
- `SongDetailPanel.tsx` — new "Sheet Music" section
- New: `music/SheetMusicViewer.tsx` component
- Data: one ABC notation file for the POC song

---

## 8. V1 Dead Code Removal

### 8.1 Analysis

**V1 calendar components (`src/components/calendar/`):**
| File | External references | Safe to delete? |
|------|--------------------|-----------------|
| `SeasonAlert.tsx` | **Used by dashboard** (`src/app/page.tsx`) | NO — move to `components/ui/` first |
| `CalendarShell.tsx` | Only referenced by old `/calendar` page (now replaced) | YES |
| `AgendaView.tsx` | Only by CalendarShell | YES |
| `MonthView.tsx` | Only by CalendarShell | YES |
| `WeekHeader.tsx` | Only by AgendaView | YES |
| `EventCard.tsx` | Only by AgendaView/DayDetailPanel | YES |
| `EventEditor.tsx` | Only by CalendarShell | YES |
| `DayDetailPanel.tsx` | Only by CalendarShell | YES |
| `CalendarToolbar.tsx` | Only by CalendarShell | YES |

**Shared utilities:**
| File | External references | Safe to delete? |
|------|--------------------|-----------------|
| `calendar-utils.ts` | **Used by**: booking/BookingGrid, today/TodayShell, today/CantorBriefingCard, admin/MembersShell, choir/MassSignupCard. Specifically `getEnsembleColor()`. | NO — extract `getEnsembleColor` to a shared util first |
| `calendar-types.ts` | Used by V1 calendar components + today/TodayShell, today/CantorBriefingCard, today page | NO — types used by today view. Move shared types. |
| `ministry-calendar.json` | Only by old calendar page.tsx (now replaced) | YES |

### 8.2 Cleanup Plan

1. Move `SeasonAlert.tsx` from `components/calendar/` to `components/ui/`
2. Extract `getEnsembleColor()` from `calendar-utils.ts` to a new `lib/ensemble-utils.ts`
3. Move shared types (`CalendarEvent`, `CalendarEventType`) from `calendar-types.ts` to `lib/types.ts` (or keep in calendar-types.ts and just leave it)
4. Update all imports
5. Delete the 8 V1-only calendar components
6. Delete `ministry-calendar.json`
7. Verify build passes

---

## 9. Quality Gates

### 9.1 Test Setup (P5-01)

Install Vitest. Write tests for critical pure functions:

1. **`recommendations.ts`** — scoring algorithm: given a known occasion and song set, verify expected ranking order
2. **`psalm-matching.ts`** — correct psalm identified for a known lectionary citation
3. **`duplicate-detection.ts`** — known duplicates detected, non-duplicates excluded
4. **`getLiturgicalSeason()`** — returns correct season for dates spanning the full year (test Ash Wednesday, Easter, Advent start, edge cases)
5. **`getOccasion()`** — returns correct data for known occasion IDs
6. **`getLiturgicalYearRange()`** — correct start/end dates for various reference dates
7. **`formatTime12h()`** — time formatting edge cases

**Constraint:** All synopses throughout the app must be AI-generated summaries or paraphrases. Verbatim scripture text cannot be displayed due to copyright. USCCB readings can be linked to but not reproduced. This applies to: occasion detail synopses, Plan a Mass custom reading synopses, comparison view text, funeral/wedding reading descriptions.

### 9.2 Supabase Type Generation (P5-02)

Run `supabase gen types typescript` to generate `database.types.ts`. Replace all `Record<string, unknown>` casts in:
- `src/app/calendar/page.tsx` (the new V2 page)
- `src/app/today/page.tsx`
- `src/app/occasion/[id]/page.tsx`
- Any API routes using raw Supabase responses

### 9.3 Web Quality Audit (P5-03)

Run against deployed app:
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1
- Lighthouse: Performance > 90, Accessibility > 90
- Known risk: the planner grid may have high INP due to drag-copy event handlers

### 9.4 External Code Review (P5-04)

PAL MCP review of the 3 most complex files:
1. `recommendations.ts` — scoring algorithm correctness
2. `PlannerShell.tsx` — drag-copy state management, race conditions
3. `CalendarV2Shell.tsx` — data transformation, scroll performance

---

## 10. Execution Order

### Phase Sequence

```
P1-05 (V1 cleanup)          ← prerequisite for clean design work
  ↓
P2 (Design System)          ← generates design.md, tokens, Stitch screens
  ↓
P2-apply (Apply designs)    ← page-by-page visual upgrade
  ↓
P3 (Accessibility)          ← done after visual changes are stable
  ↓
P4 (New Features)           ← GA slot, enriched index, notes, sheet music
  ↓
P5 (Quality Gates)          ← final: tests, types, audit, PAL review
```

### Session Breakdown

| Session | Scope | Version bump |
|---------|-------|-------------|
| **S1** | P1-05: V1 dead code cleanup (move SeasonAlert, extract getEnsembleColor, delete 8 components) | v1.19.2 |
| **S2** | P2-01 + P2-02: Screenshot key pages, generate design.md, audit and fix color violations | v1.20.0 |
| **S3** | P2-03 + P2-04: Stitch redesign of 5 key pages, apply to codebase | v1.21.0 |
| **S4** | P2-05: Fix overflow:hidden, verify iOS Safari, test all layouts | v1.21.1 |
| **S5** | P3: All 4 accessibility steps (ARIA, keyboard, focus trap, contrast) | v1.22.0 |
| **S6** | P4-01 + P4-03: Gospel Acclamation compound slot + editable planning notes | v1.23.0 |
| **S7** | P4-02: Enriched Song Index (pipeline + UI) | v1.24.0 |
| **S8** | P4-04: Sheet music playback POC | v1.25.0 |
| **S9** | P5: Tests, types, audit, PAL review | v2.0.0 |

### Version Strategy

Minor bumps for each feature phase. v2.0.0 is earned after all quality gates pass. This is a earned milestone, not a marketing version.

---

## 11. Jeff's Brain Dump: Complete Feature Vision

*Source: "Bonilla Brain Dump" Google Doc, voice-transcribed. Every detail preserved verbatim in intent. Nothing omitted.*

### 11.1 Multi-Parish Scalability and Cloud Media Architecture

- The app must be scalable to the point where any parish across the country could use it.
- St. Monica's content (sheet music, audio recordings, worship aid generation, ProPresenter slide generation, forScore exports) cannot ship to other parishes because Jeff doesn't know that they have permission to use those songs.
- Recommendations (song suggestions based on readings, seasons, etc.) CAN ship to everyone. The recommendation engine is universal. The copyrighted media files are not.
- Other parishes need a way to upload their own libraries. Options: link to a folder they already use (Dropbox, Google Drive), or upload directly into the app.
- If there's a subscription model, the files that parishes upload must be accessible to their entire music ministry without the music director's computer being open. Cloud-hosted. Always available.
- The app must be maintainable by someone in IT and AI. It cannot be a hobbled-together thing with no master plan. From a design perspective, it needs to look and feel like a real product.
- The app is an all-in-one music director. If a parish can't afford a music director, then this app does all the work for you.
- **App name:** Needs a real name that doesn't feel like it has "AI" in it. Ideas floated: "Assistant Music Director", "Music Director". No name chosen yet.

### 11.2 Onboarding / Setup Wizard (Multi-Parish)

The setup wizard is the first thing a new parish sees. The exact flow Jeff described:

1. **Welcome:** "Thank you for giving [app name] a chance." They get a demo. It starts with a setup.
2. **Resource inventory:** "What are your main resources? OCP Breaking Bread? GIA Gather 4?" They select which publishers they use. Do they use screens (inform ProPresenter slide generation)? Do they do worship aids from several publishers?
3. **Favorite songs by function:** "You picked Breaking Bread. What are some of your favorite gathering songs from Breaking Bread?" Click from a list. Then: "Pick some communion songs that you love." This seeds the familiarity model.
4. **Auto-populate offer:** "Would you like me to populate song selections based on the readings and songs inspired by songs that your community loves?"
5. **Parish personality:** "Would you say your parish is mostly into traditional music, contemporary, or a pretty good mix of the two? Are some masses more traditional and some more contemporary?"
6. **Mass count:** "How many masses do we plan for?"
7. **3-year cycle generation:** Toward the end of the questionnaire: "Do you want me to try to populate music for the liturgical year, or for the three-year cycle, based on what you've told me about your community?" If yes, the app generates an entire 3-year cycle, all mapped out.
8. **Repetition control:** The generated plan respects a philosophy: gathering songs in Ordinary Time should max out at about 10, because if you have more than that, people never learn them. If every mass is fully bespoke, no one knows any songs and they're just listening. There should be a slider where you pick the level of repetition. "People aren't really singing at mass" → "Would you like me to adjust the song lists so songs repeat a little more so people have a chance to learn them?" You choose how far out to increase repeatability.
9. **Dynamic feedback loop:** The app periodically asks: "How's it been going? Does it seem like people have been singing at mass?" Based on the answer, it can adjust repetition up or down.

### 11.3 Song Selection UX (Inline Recommendations)

- At any point, the music director can pick a different song. They click on the gathering song and beneath it, suggestions appear that fit the readings of the day or the part of the mass. Opens beneath the current assignment so you can easily pick something.
- Each suggestion shows: how many weeks since you've done it, how long ago it was on the song list, and how many weeks until it comes up again. Programmatic.
- If the dropdown doesn't have a song you like, click "See more." A popover window opens with many song suggestions and explanations of why each might be good for that particular week. "What makes this song great."
- **Slot-aware filtering is absolute:** If it's a responsorial psalm slot (e.g., Divine Mercy Sunday, Psalm 118), clicking on it should ONLY show other Psalm 118 settings or a common psalm for the season of Easter. No other options. If clicking on the gospel acclamation, ONLY gospel acclamations can be entered.
- When you pick a GA or mass setting: "Do you want this setting for the remainder of the season, or for how many weeks? Do you want this only for this cycle, or for all three year cycles?" Then it just populates everything. Play button works. Sheet music works.
- The GA row should expand to accommodate a link for the refrain AND a link for the verse, because the verse is sometimes recorded separately from the refrain/response.
- **Play button and sheet music button** visible from the suggestion list. Click sheet music and it pops open to preview inline. "You're able to look at the music while it's playing. How novel is that?"

### 11.4 Calendar Enhancements

- **Traditional calendar view option.** The agenda/row view is Jeff's preferred. But many people want a traditional monthly grid.
  - Week start: default to Monday (everything in a music director's world leads to Sunday), but users can pick Sunday.
  - When you pick a calendar view, you can see details below the calendar based on what day is selected.
  - Day view with actual time slots so you can fill in different times.
  - If your printout for the choir needs arrival times, meal times, break times, you can print that out as a PDF. And from that page, print a song list / "menu" for that day.
- **Calendar subscriptions (iCal import):**
  - There's a school calendar one group keeps. A school liturgy calendar. A parish calendar. The Mazevo booking system (who has what in what space).
  - Jeff wants to subscribe to external calendars. Then rename the calendar at the top (e.g., "SMT" → "School"). Reveal/hide that calendar in the calendar view. It dynamically adds everything from that calendar.
  - A "+" button to cherry-pick individual events from the imported calendar into the main music calendar. Once added, it persists even if you uncheck the imported calendar. Edits to the copied event don't affect the source. Independent copies.
  - People can subscribe to Jeff's calendar that has all the music things. The calendar has a permalink.
- **Patricia's priest schedule:** Patricia is the administrative assistant. She enters which priests are at which masses, who's on duty, the schedule. Jeff wants to give her a template, and she enters her information on the website in her own portal. It automatically populates the calendar view. She can also export it exactly how her current template looks (PDF). By entering it on the website, she has also populated which priest is at which mass, which is helpful for planning (e.g., if the deacon is present, likely no sung Kyrie because he'll speak it with invocations).
- **"Plan a Mass" pill** on the dashboard that links to the planning form.
- Adding an event from the calendar view should jump to the Plan a Mass page with the date pre-populated.
- **Mobile:** The calendar needs a killer mobile view so people can access it from their phones to know what's going on. Along with sign-ups.

### 11.5 "Plan a Mass" Form

Accessible from dashboard ("Plan a Mass" pill) or from calendar (add event → mass/liturgy). Anyone who needs to plan a mass can use it: music directors, liturgists, school staff (Suzette, the director of spirituality), anyone. Maybe she has a permanent link.

Dynamic questionnaire:
- What am I planning? Weekday mass? Weekend mass? Sacramental mass? Confirmation mass? Is the bishop celebrating?
- Who's the celebrant? What time? Is music requested for this mass?
- Is a cantor + piano requested?
- If it's a school mass: is it the entire school or just part? Upper school? (St. Monica has upper school and lower school including middle school. Different student musicians and different music teachers for each.)
- **Collaborative:** The creator should be able to invite other people to the link. They have access to enter songs. As they pick songs, it auto-populates: composer, Breaking Bread number (or Gather 4 number for other communities). It makes suggestions based on the readings.
- **Custom readings:** If it's a school mass, you have the option to substitute the readings. "Are you doing the readings of the day? Yes/No." If no, enter what readings you're doing. The app populates a one-line synopsis (AI-generated, not verbatim scripture, because we don't have permission for verbatim text). Can link to the USCCB readings of the day.
- Fields for: student readers, students bringing up the gifts, hospitality ministers (who will be welcoming people), ushers, Eucharistic ministers, the sacristan.
- **Notifications:** If you're a cantor at that mass, do you receive a notification? Opt-in. Reminders: day before? How often? SMS, email, they should be able to choose.
- When complete: all dates, celebrant, music director/ensemble auto-populate the calendar.

### 11.6 Planner View / Multi-Week View Upgrades

- **Rename:** "Planner View" → "Multi-Week View" because it's only a planner when you're the music director. For everyone else, it's a multi-week overview.
- **Comparison View → Single-Liturgy View for non-directors.** Directors can compare 2 different masses side by side. Non-directors see a single liturgy view for one set of readings.
- **Easter Sunday duplication bug:** Easter Sunday appears in both Holy Week and Easter sections with songs populated in each. It should appear ONCE. The Holy Week section should reference it, and the Easter section should own it. The color should be Easter gold/amber.
- **Liturgical art images:** We use images as liturgical art on screens (ProPresenter). A static image based on the readings for the weekend. It would be lovely if that image could be dropped in above the occasion header and live there. Any integration with ProPresenter where slides or art can get synced to the server via a cloud drive (Dropbox) would be amazing.
- **Play button in grid cells:** Listen to linked audio from the multi-week view without navigating away.
- **Sheet music button in grid cells:** Click to expand download options. If not in director view, you can press play and download resources or preview sheet music inline ("look at the music while it's playing").
- **Director view vs. member view:**
  - Director: drag-copy, cell editing, resource download, remove songs.
  - Member: play button, sheet music preview, read-only.
- **Remove song from cell:** Currently no way to remove a song once placed. Need an X/exit/clear button.
- **Edit collision fix:** The edit button on hover collides with the cell below it. Cannot happen. Needs repositioning.
- **Custom rows with show/hide toggles:** Add rows for: Prelude, Homily Reflection Song, Post-Communion Meditation Song, Choral Anthem. Like existing "Hide Readings" toggle. "Show prelude." "Show homily reflections." "Show post-communion meditation song." "Show choral anthem."
- **Renameable slot labels in settings:** Right now it says "Communion" and "Com 2" or "Com 3." Some people call the gathering song an "entrance chant." The offertory might be "offertory song" or "preparation of the gifts song" or "gifts song." Sending vs. "sending forth song." Settings should offer presets or custom rename. Gathering/Entrance Chant. Offertory/Preparation of the Gifts. Sending/Sending Forth. Communion/Communion Song.
- **Things Jeff loves about the current planner:** Show/hide toggles, cycle selection (single or all), season picker, ensemble picker, show 4/8/12 weeks. "Fantastic."

### 11.7 Occasion/Season View Fixes

- **Ordinary Time sorting:** Currently 107 OT instances line up cycle A next to cycle B next to cycle C (parallel). Thanksgiving is at the top. Jeff wants sequential/chronological order within each cycle year. Thanksgiving should be in November. Saints Peter and Paul should only show if it's on a Sunday, or if it's a solemnity. "I would rather they be in sequential order so that Thanksgiving lives wherever it lives in a year view."
- **Nativity multiple readings:** Christmas has Mass at Dawn, Mass During the Day, etc. These are underrepresented. Must have all variants.
- **Solemnities → "Holy Days":** Instead of "Solemnities," rename the section to "Holy Days" which includes both solemnities and feast days, all in chronological date order. Start with the Immaculate Conception (first solemnity of the year).
- **Holidays section:** Below Holy Days, a separate section for civil holidays where the parish does music (Thanksgiving, etc.).
- **Music indicator toggle:** In director view, toggle a music note icon (a set of eighth notes) to denote which liturgies will have music.
- **Ash Wednesday:** Jeff likes that it goes all the way across because it's the same cycle of readings. Like Christ the King (though Christ the King has different readings technically).
- **Good Friday data errors:** The order of worship shows "all ensembles simplified plan" and "all ensembles regular" but Jeff doesn't know what the difference is for Good Friday. There's just one plan. And it says "Good Friday, Gloria is expected for this solemnity." There is no Gloria on Good Friday. In fact, the first thing you hear is the Psalm. It just starts with the Liturgy of the Word. The "no section" shows "Presider TBD" with no edit button. Jeff can't change any of that. Needs an edit button.
- **Other Liturgies:** Currently just says "Other Liturgies" with a music planning template. Needs to be much more sophisticated. Once planned and entered, all dates, celebrant, ensemble, music director should auto-populate the calendar.

### 11.8 Liturgical Color Corrections

- **Palm Sunday bullets:** Red (correct).
- **Holy Thursday bullet:** Should be white, with a blue outline acceptable. Currently shows blue.
- **Good Friday bullet:** Red (correct).
- **Easter Vigil bullet:** Burnt orange. Not the liturgical color, but it represents the transition from Good Friday red to Easter gold. Burnt orange = the color of fire, like the candle at the beginning of the Easter Vigil liturgy. Like an ember.
- **Easter Sunday bullet (in Holy Week view):** White with a gold ring around it.
- **Easter sidebar bullet:** White with a gold ring (matching the Holy Week view).
- **Easter Sunday should NOT be duplicated:** Currently appears in both Holy Week and Easter. The Holy Week view has songs populated, the Easter section has songs populated. But in the Easter planner view, it's not there. Should be represented once, owned by Easter, referenced from Holy Week.

### 11.9 Today View Enhancements

- Currently "really paltry." Shows the day with the color, lectionary number, whether there's an Alleluia, whether Gloria is omitted.
- Inspired by Verbum (an incredible app). Needs more:
  - Today's readings with a link to the USCCB website to view them.
  - Saint of the day.
  - "5 days until Sunday, don't forget to practice this song" style reminders. The app knows you have a new song coming up and helps you prepare.
  - A "coming up" section that's more fleshed out. Anything interesting about the upcoming liturgical days.

### 11.10 Announcements / Community Board

- As an admin, Jeff wants it to feel like a community bulletin board.
- Two tracks: an announcement track (official announcements) and a community board (where stuff can get pinned at the top).
- Click on an announcement and it expands into the event details. Should look stunning, next-level design.
- **Member birthdays:** Auto-post birthdays to the announcements. Just month/day, not year. The birthday field lives in the member profile.

### 11.11 Booking Grid / Musician Management

- The booking grid should auto-populate the menu/setlist with who's going to be where, what instrument they're playing.
- **2-week-out notifications:** Notify Jeff if he doesn't have someone booked for a slot.
- **Reminders to musicians:** The booking grid should send out reminders that they have a mass coming up.
- **Print/export:** Print the booking grid or export it to see who was at what mass.
- **Musician history lookup:** Any musician (e.g., John Blanda) can go to the booking portal, look up all the masses they've ever done, pick how far back it goes, and export what masses they did. Game changer.
- **Invoice generation:** If that export could be like an invoice. A St. Monica invoice that's self-generated. Export as PDF or DOCX. If the admin can enter agreed-upon amounts, it auto-calculates. Game changer.
- **Sub request system:** Jeff specifically described Ministry Scheduler Pro's feature where a minister says they need a sub and volunteer ministers can pop in and fill the slot. Wants this with guardrails: each mass is different, different directors have preferences. Rolling order of sub requests. The app sends a text to the first person on the list, they accept or decline. Initial message, then "last chance," before moving on to the next person on the sub list. This feature should be spec'd out thoroughly before being deployed.

### 11.12 Members

- Admin can **create accounts for members** (for the elderly lady who can't self-register).
- Admin can **edit member names and emails.** Example: David's name auto-populated as "Clockwood" because his email is DavidC.Lockwood, but C is his middle initial, not the first letter of his last name.
- **Birthday field:** Month and day only, no year. Birthdays auto-post to the announcements board.

### 11.13 Messages (SMS/Email)

- **SMS bug confirmed:** Jeff tested sending a text to himself ("El Jefe" and "Jeff Bonilla"). Got "Confirmed Sent. Only members with SMS consent..." then clicked send, got "no consent/contact." Tried email: "Hi Jeff" to himself. "0 messages, 2 skipped." Nothing sent. Needs to be figured out.
- **Enhanced recipient filtering:** Jeff needs to filter recipients more granularly. Pick a mass (by date), pick which masses on that date or all masses, then select all people involved for that day. Send a message. Or custom from within that day. Or by ensemble. "It just needs all of those awesome filters."

### 11.14 Compliance

- Whoever takes care of compliance needs to be able to drop in PDFs or scans for everyone. Each document has an expiration date and is basically on file. This is for Virtus training compliance.
- **Fingerprinting LA Catholics:** That link works. That's fantastic.
- **Safe Environment Renewal sign-up:** Dead link. Needs to be fixed. On the to-do list.
- **Virtus Online:** That link works. Great.

### 11.15 Wedding & Funeral Portals

*Source: Jeff's Brain Dump + Wedding Music Guide (10-step Google Sheet) + Funeral Music Worksheet (14-step Google Sheet)*

**The Wedding Portal:**

Jeff designed step-by-step guides to selecting songs for weddings in Google Sheets. He has both a PDF version and the actual sheet links accessible via GWS. He doesn't think they're beautiful. The song selections can be deeply enriched beyond what's currently there.

The vision:
- People can pick their cantor from the website.
- Wedding coordinators can enter details from the website, from this partitioned wedding planner portal.
- The music director can give out a link to this wedding planner.
- It takes you through step by step picking your songs and explains why each part of the mass happens.
- It needs to be made much better: clearer, easier to understand, yet still a little catechetical (a teaching moment).
- It keeps everyone on the same page: wedding details, rehearsal times, contacts, timelines, musicians confirmed and booked.
- It's not only a planning portal but also a tracker that keeps everyone honest about what's happening when.
- **AI FAQ chat:** Integrate an AI response that understands the music ministry's policies. All of that is backlinked and indexed. If couples have a question, the chat responds.
- **Cantor profiles:** It doesn't matter what cantors look like. Their looks don't matter. It should be their voice. First name and an initial. Audio recordings of them singing (not video). You listen to the singer singing a handful of songs. David Lockwood will record with the cantors. Brief bullet points: this cantor is bilingual, some favorite songs for weddings, what masses they regularly sing at (if you want to catch them at a mass).
- For funerals: "Would you like us to meet with you, or would you like your family to go through this?" If the family goes through it, there's an easy-to-understand tool that allows them to pick the music.
- **Export:** Anyone interfacing with it can export a document with all the notes. A beautiful 8.5x11 PDF. Elegant. Whether it's a funeral or a wedding: times, musician names, how much the family needs to bring to pay musicians. All of that.

**Wedding song data (from the 10-step Google Sheet):**

150+ curated songs across all steps with categorization:
- Step 1 (Preludes): Classical, Contemporary Christian, Pre-approved Secular. Each with instrumentation notes (piano, opt. singer, violin, cello, guitar, etc.). Star ratings (✪) on top picks.
- Step 2 (Processions): Bridal party entrance + bride's entrance. Classical Instrumentals, Contemporary Instrumentals, Catholic Classics.
- Step 3 (Responsorial Psalm): 7 psalm options mapped to Together for Life codes (C1-C7) with traditional and contemporary settings per psalm.
- Step 4 (Gospel Acclamation): Traditional and Lenten options with gospel verse selections.
- Steps 5-6 (Gifts Song + Mass Setting): Classical, Contemporary Christian, Traditional/Contemporary mass settings with specific acclamation components (Holy, Memorial, Amen, Lamb of God). Bilingual and Spanish options.
- Steps 7-8 (Communion Songs + Meditation): Traditional Catholic, Traditional Reimagined, Contemporary Christian. Meditation songs categorized by female cantor, male cantor, and duets.
- Steps 9-10 (Flowers to Mary + Recessional): Classical Ave Maria options, Catholic Classics, Choral (requires choir). Recessional: Classical Instrumentals, Upbeat Secular, Traditional Catholic Hymns, Upbeat Contemporary Christian.

**Funeral song data (from the 14-step Google Sheet):**

200+ curated songs across 14 steps:
- Step 1 (Preludes): Religious and Secular options with clear delineation.
- Step 2 (Opening Song): Traditional and Contemporary options plus Spanish language options (Entre Tus Manos, Pan de Vida, Resucitó, Renuévame, Tuyo Soy).
- Step 3 (First Reading): 7 Old Testament options + 4 New Testament options (during Easter season, Apr 20 - Jun 9). Each with pre-written 3-line poetic summaries.
- Step 4 (Responsorial Psalm): 25 individual psalm settings organized by psalm number (Ps 23, 25, 27, 42, 63, 103, 116, 122, 130, 143, 145) with traditional and contemporary versions.
- Step 5 (Second Reading): 15 New Testament options with 3-line summaries.
- Step 6 (Gospel Acclamation): Traditional and Contemporary options, with separate Lenten options and a note about the Lenten season dates.
- Step 7 (Gospel Reading): 19 Gospel readings with 3-line summaries spanning Matthew, Mark, Luke, and John.
- Step 8 (Gifts Song): Traditional and Contemporary options.
- Step 9 (Mass Setting): 6 mass settings (3 Traditional, 3 Contemporary) with additional Lamb of God options.
- Step 10 (Communion Songs): Traditional and Contemporary options.
- Step 11 (Meditation): Traditional and Contemporary options plus Spanish language options.
- Step 12 (Song of Farewell): Traditional and Contemporary options plus bilingual option.
- Step 13 (Closing Song): Traditional and Contemporary options plus Spanish language options.
- Step 14 (Additional Considerations): Same as Step 13 (appears to be duplicated in source).
- Funeral Template: Memorial Mass format showing full liturgical order with placeholder fields for each slot.

### 11.16 Setlist/Menu View

- Once all songs are picked and everything is selected, there needs to be one more view: the menu/setlist.
- The menu is a song list with: songs (no audio links, just titles), solo assignments, booking information (what musicians will be there, what instruments they're playing so the sound person knows how to set up), and any special notes for the liturgy.
- Could be a tab that people can view. Maybe it's called "assignments view" or "song menu" or "set list."
- Printable as a clean PDF or DOCX.

### 11.17 Music Library Cleanup

- "Messy as hell, missing a lot of stuff, weird duplicates, kind of crazy."
- **Duplicate detection false positives:** It shows a gazillion duplicates for "Alleluia, Mass of Joy and Peace." But that's a gospel acclamation with different verses per Sunday. Each verse has different music that needs to be linked to each specific Sunday. Those shouldn't show up as duplicates.
- **Plan:** Wipe everything clean and do fresh imports. Jeff has lots of good stuff for this (fresh OCP/S&S chart downloads).

### 11.18 Comparison View Psalm Text Bug

- Psalm text has no line break from the scriptural verse to the refrain text.
- What shows: bold scriptural verse, no line break, right into the response. Then below it, the same thing in light gray, not bold, and it's the exact same content.
- **What it should be:**
  - Scripture citation (e.g., "Ps 122:1-2, 3-4, 4-5, 6-7, 8-9"): light gray, not bold.
  - Refrain/response text: "a nice gray-blue that doesn't look like a link. Not black. Dark, elegant."
  - Verbatim liturgical text (actual responsorial psalm refrain, entrance antiphon, communion antiphon, gospel acclamation verse): **burgundy.** So Jeff knows "that's what it actually is."

### 11.19 Custom Ensembles and Branding

- St. Monica's masses have brand names: "Foundations" (early Sunday morning), "Reflections" (Saturday Vigil). Each has a branded tag color.
- Other communities might call it "the 11:30 choir" or "the Saint Cecilia" whatever. They might not use branded names.
- To scale: communities need to pick their own colors and name their own mass groups/ensemble groups/choirs. The app dynamically applies those names and colors across everything.

### 11.20 Season Briefing and Other Views

- Season briefing looks great. Jeff is a fan.
- The current "Other Liturgies" view just shows a music planning template. Needs to be way more sophisticated: bookmark/placeholder-style views that you come back to. Once you plan and enter it, dates/celebrant/ensemble/music director should auto-populate the calendar.

---

## 12. Arielle Braindump: Complete Operational Knowledge

*Source: "Arielle Braindump - Phase 1: The What and The Map" Google Doc. Full knowledge capture from outgoing Music Ministry Associate. Every answered question preserved. Unanswered questions noted.*

### 12.1 File Naming Conventions and File Organization

**Origins and system:**
- `yymmdd_hhmm` format: inherited from Merrick to keep documents in chronological order, especially recurring ones (worship aids, menus).
- Song name format evolved over time for consistency: `[song name] - [composer surname]`
- Mass parts format: `[song name] - [mass setting] - [composer surname], Arr. [arranger surname]`
- Multiple composers: separate with underscore ( _ ) to avoid special characters.
- **Key rule:** When including a mass part in the title, omit "Mass of" because it's redundant. Nearly every mass setting begins with those words, making keyboard shortcuts useless. Example: instead of "Mass of Restoration - Joshua Blakesley & Leland G. 'Grae' McCullough," title it "Restoration - Blakesley_McCullough" so typing "R" jumps straight to that file.
- Abbreviations: LS (lead sheet), SATB-D (SATB with descant), KBD (keyboard), CLR (color), AIM (unknown, some should actually be labeled CLR).
- Not every file follows this convention. Arielle was adjusting files week by week as they went. This was her first attempt to document it.
- **No master reference document.** It was all in Arielle's head until this braindump.
- Tools: Dropbox and Finder. Nothing else.

### 12.2 Music Resource Accounts

**Sheet music sources (Jeff should have login info):**
- **ICR Music:** Full catalogue for Breaking Bread and Spirit & Song. Has almost everything needed for any Catholic composer. If it exists here, Arielle downloads ALL resources for that specific song so everything is consistent: the reprint matches the sheet music, the lyrics (especially translated songs) are the same from slides to choir charts to lead sheets.
- **PraiseCharts:** For worship songs. Some Dorico orchestrations now available.
- **OCP:** Direct publisher. One-time purchases charged to Mark Neal's card, receipt forwarded to Lydia Williams.
- **GIA:** Direct publisher. Same payment process.

**Worship aid assets:**
- USCCB
- The Kids' Bulletin
- LPi Art (subscription)
- One License (subscription, reprint licensing)

**Subscriptions requiring renewal:** ICR, One License, LPi Art. Arielle doesn't know who handles payment.
**One-time purchases:** OCP, PraiseCharts, GIA.

**Fallback search chain when a chart can't be found:**
1. ICR or PraiseCharts
2. Spotlight search Dropbox for old scans
3. OCP or GIA directly
4. Google it. Could be on MusicNotes. Maybe not published but someone transcribed it. Maybe the artist sells directly from their own website (e.g., Francesca LaRosa).

**Personal contacts:** "No, they reach out to me hehe."

### 12.3 Music Transcription and Charting

**Software history:**
- All of Catholic publishing was on Finale. Arielle was very fast and efficient at transcription.
- Everyone has been transitioning to Dorico. Even PraiseCharts now has some Dorico orchestrations. Jeff bought one and had Arielle modify it. The bespoke template is the one shared with the Auto Transcription Skill/Pipeline.
- A vast majority of Finale files were exported to MusicXML in fear of losing access to Finale with OS updates. These MusicXML exports are the crown jewel of the repertoire. A ton of St. Monica adaptations and arrangements.

**Chart types:**
- No chord charts. Jeff has always dreamed of having a single drummer's sheet with measures, cues, and rhythms.
- Mostly lead sheets with SAT choral stacks all in the same line.
- Melody has normal-sized noteheads. Tenor and alto noteheads at about 70% size.
- Typical stack from top to bottom: SAT (soprano and bass on melody).
- Occasionally the melody is in the middle note: TSA (top to bottom).
- Almost never ATS.

**Copyright/licensing process:**
- Arielle: "ssshhhhhhh"
- Jeff: "We have never done this well. I would like us to investigate automating our reporting once songs are selected agentically via the ritualsong app."

**Repertoire library:** Each song has a folder. Jeff made a copy for the initial migration into the Ritual Song app. Liturgically on a 3-year cycle. Songs repeat enough for the assembly to feel confident singing along, but not so often people want to break their skulls against the pew in front of them.

### 12.4 Musician Scheduling

**Typical weekend scheduling process:**
- Some musicians have recurring slots. Most of those are not followed up to confirm. They contact Arielle if they need a sub.
- Monthly: check in with recurring slots who have variable availability.
- Bassists scheduled on monthly rotation: start by asking Allee, Frank, and Dominic for availability. Frank mostly takes 9:30s. Allee prefers 9:30s but does not have seniority over Frank.

**Jeff's notes on scheduling:**
- Arielle maintained the '2026 Booking' tab in 'MM - MASS PREP' Google Doc (accessible via GWS). This is the most up-to-date booking source, migrated into the app in v1.
- This facet is massive and critical to mission success. Huge potential for automations.
- Jeff wants: regular musicians can flag weeks needing a sub → messages go out one at a time to the instrument-specific sub list in the order presented → accept/decline → initial message then "last chance" before moving to next person.
- Generally, booking more than 2 months out is not favored by most musicians. They keep options open.
- Sometimes they forget about players who'd be great because they're 15th on a call list. That's why lists are so great.
- **"Bench" tab** on 'MM - MASS PREP': ordered sub list. Needs updating from Arielle and David.
- **Submissions portal idea:** When people want to be added to the bench, a portal that filters out people they likely wouldn't want to waste time meeting with, but also helps deepen the bench.

**Complete recurring musician roster (from Arielle):**

**Christa:** One weekend every month. Check in monthly to confirm which weekend. Saturday: alto + guitar. Sunday 7:30, 9:30, 11:30: alto. Can sub as soprano or cantor.

**Sat 5:30p:**
- Cantor: Cindy Torroba (regular)
- Soprano: Suzanne Selmo (regular)
- Tenor: Noel Serrato (check in monthly)
- Percussion: Greg Terlizzi (check in monthly)
- Tenor/Piano/MD: David (regular)

**Sun 7:30a:**
- Cantor 1st, 2nd, 3rd Sundays: Heather Catalena (check in monthly)
- Cantor 4th Sundays: Helena (check in monthly)
- Tenor/Piano/MD: David (regular)

**Sun 9:30a:**
- Cantor: Teresa Weiss (regular)
- Tenor: Merrick Siebenaler (regular)
- Tenor/Piano: David Lockwood (regular)
- Drums: Eric Jackowitz (check in monthly)
- Bass: various (schedule monthly)
- E. Guitar: Lorenzo Forteza (regular)
- A. Guitar: Eddie Kaye (regular)
- A. Guitar/MD: Jeffrey (regular)

**Sun 11:30a:**
- Cantor: Grace Doyle (regular)
- Alto: Teresa Weiss (regular)
- Tenor: David Lockwood (regular)
- Piano/Organ: John Blanda (regular)
- A. Guitar: Jeffrey (regular)
- Choral MD: Tica O'Neill (regular)

**Sun 5:30p:**
- Cantor: Evelyn Fajardo (regular)
- Alto: Teresa Weiss (regular)
- Tenor/E. Guitar: Micah Jones (regular)
- Drums: Nate Laguzza (regular)
- Bass: various (schedule monthly)
- A. Guitar: Dylan Caligiuri (regular)
- Tenor/Piano/MD: David Lockwood (regular)

**Sub contacts:** Jeffrey and David handle by gut. The "Bench" tab has an ordered list but needs deepening and context.

### 12.5 Payroll

- Actively changing, so Arielle didn't go into full detail.
- Process: Check in with Lydia about check run timeline → email blast requesting invoices about a week before → use billing web portal to submit invoices one at a time → cross-check against the schedule → email Lydia a Dropbox folder link with the invoices.
- **No master rate list exists.** No documentation of who gets paid what.
- Common issues, edge cases: unanswered by Arielle.

### 12.6 Volunteer Communications and Onboarding

- **New volunteer process:** Arielle has an email template describing choir opportunities, rehearsal process, and materials process. Depending on interest level, adds them to the Flocknote email list or asks if they want to receive emails.
- **Flocknote for volunteers:** Choir email blast comes from Flocknote. For paid personnel, Flocknote is not great at sending to several specific people. Arielle's workaround: build email template in Flocknote, send a test note to herself, then forward it to the specific paid musicians.
- **Jeff's note:** Wants to transition to the Ritual Song app as quickly as possible.
- **Communication challenges:** Difficult to maintain boundaries. Arielle gets very specific questions via email (things answered in rehearsal later, or Google-searchable, like "what color should I wear for Palm Sunday"). She stopped sharing her personal cell with volunteers.
- **Scheduling communication:** Texts for scheduling check-ins. Weekly email blast with weekend setlists and schedule.

### 12.7 Weekend Prep: Archive Management

- Arielle described a detailed archive workflow with DELETE, MOVE, and COPY operations across Dropbox folders.
- She says she already documented it well enough for staff to understand.
- Nothing "breaks" if skipped, but records become unsearchable by date.
- Hyperlinks on MM - MASS PREP link new folders to coordinating dates.
- Archive recovery: yes, they reference old menus to see who sang solos, which arrangements were used. Sometimes day-of assets get dropped into the download folder (like a script for a solemnity).

### 12.8 Weekend Prep: Materials Preparation

**Song list verification:** Check for accidental blanks, songs selected twice.

**Chart selection logic (critical for the app's personnel-aware distribution):**
- Chart selection is informed mostly by personnel scheduled.
- General rule: lead sheets for band, choir charts for choirs. Include instrument chart if solo instrument.
- **David (accompanist) special case:** Sings and plays simultaneously. Cannot read two charts at once. Choral charts that include chord symbols are ideal for him.
- **Section leaders without volunteer choir:** Give them just the lead sheet. They're capable of making up their own harmonies, which is easier than reading two charts.
- **Key selection:** If you know which key a singer does a specific song, use that key. If not, include multiple keys. Example: "Love Never Fails" in Ab for male cantor, Eb for soprano, C for alto.
- **When in doubt:** Include more charts.

**Menu creation:** Uses Pages. Duplicating and updating week-to-week is intuitive.

**forScore workflow:**
- Dropbox must be linked to forScore through settings.
- **Sort manually is critical:** Annotated PDFs can only be exported in manual sort order, regardless of display sort. Even if you sort by title then export, it exports in manual order. forScore is glitchy.
- Annotations: BPM, voice parts, color coding, cuts. (Detailed annotation process and color coding conventions not fully documented by Arielle.)
- Paper packets: **Adobe Acrobat, NOT Preview.** Preview prints cropped images in original dimensions with thick black borders. Waste of ink, harder to read.
- **Page selection for packets:** If multiple charts included, only include what's relevant to the choir. Delete lead sheets if there's also a choir chart. If multiple keys included, pick just one (or two if it affects voicings).
- Heritage Mass binder: physical binder process for traditional choir (details not documented).

### 12.9 Distribution and Media

**Distribution:** Via Flocknote (described above in 12.6).

**ProPresenter (Pro7):**
- Arielle was going to record a video tutorial.
- **Artwork/GFX:** Canva for website banner and worship aid cover.
- **Worship aid process:** (Not detailed by Arielle.)
- **Website updates:** Upload banner, link to worship aid page. Upload worship aid, link on the worship aid page.

**Timeline:**
- Worship aids: used to be done by Thursday, now "at some point before Sunday."
- Pro7 setlists: can be started earlier but cannot be finalized until Saturday evening.
- Intercessions: not distributed until noon on Saturdays, with final edits at 4pm.

**Who else touches the media workflow:**
- David knows how. Austin was trained a long time ago.
- Trained on running playback: Mary Phan, Merrick, Teresa, Christa, Lorenzo Forteza, Noel Serrato, Gabriel Sayegh.
- Sam sometimes drops in wedding or funeral photos (doesn't affect workflow much).

**ProPresenter sync (critical operational detail):**
- Syncing does NOT happen automatically. All syncing up or down must be triggered manually.
- **Common error:** Someone changes something on the laptop in the media loft (e.g., Dan routing video or sound output) and doesn't tell Arielle. She ends up overriding it with old settings during the weekly sync.
- **Rule:** If a change happens in the loft, it needs to be reflected on the host computer too. Sync UP from the loft, then DOWN to the host computer.
- Caveat: This may cause duplicate projects because ProPresenter is dumb like that.

### 12.10 Day-of Operations

Sections 10.1 through 10.5 were unanswered by Arielle (day-of workflow, reels, intercessions, sync loft, iPad management, set spaces for rehearsal, emergency protocol).

### 12.11 General File Management

Sections 11.1 through 11.5 were unanswered by Arielle (other file management, Dropbox folder map, shared drives, what Jeffrey accesses, hardest thing to recreate).

### 12.12 Bonus: Undocumented Knowledge

Sections B.1 through B.5 were unanswered by Arielle (tasks not on list, relationships, seasonal tasks, things Jeff doesn't know about, first-day advice).

### 12.13 Rehearsals and Spaces

- Parish uses Mazevo for booking. All have logins but Arielle did the majority of booking.
- Jeff needs to be reminded to incorporate Mazevo into his workflow.
- Yearly calendaring meeting in the summer before school year starts. Ideally, they'd look at the program year and have ducks in a row to request spaces then.
- Large events (Christmas, Triduum): Jeff handles these, and it happens too late. He wants to lock in key people during the summer for the main things, then everybody else 3-4 months before if willing to book.

---

## 13. Visual Issues from Screenshots

| Screenshot | Issue | Action |
|------------|-------|--------|
| Planner Easter duplication | Easter Sunday appears in both Holy Week and Easter sections with different data | Deduplicate: one canonical occasion, referenced from both seasons |
| Psalm text formatting | No line break between citation and refrain text; both bold | Fix: citation in light gray, refrain in dark elegant color, literal text in burgundy |
| SMS send failure | "0 messages, 2 skipped (no consent/contact)" | Debug SMS consent flow: check if opt-in mechanism works, verify Twilio config |
| SMS confirm dialog | "Send sms to 2 recipients?" but both skip | Same root cause as above |
| Verbum app | Reference for Today view design inspiration | Study layout: saint cards, daily readings, study tools, community content |
| Good Friday Gloria error | "Gloria is expected for this solemnity" shown for Good Friday | Fix: remove Gloria flag from Good Friday occasion data |
| Good Friday presider/section | Presider shows as "TBD", "no section" displayed, no edit button | Fix: update Good Friday occasion data with correct presider handling; add edit capability to all occasion detail pages |

---

## 14. Revised Feature Inventory (Complete)

Everything from all sources, deduplicated and categorized by complexity:

### Tier 1: Bug Fixes (do now)
1. Easter Sunday duplication in planner (Holy Week + Easter sections)
2. Good Friday "Gloria expected" data error
3. SMS/Twilio consent flow broken (0 messages sent)
4. Compliance "Safe environment renewal" dead link
5. Psalm text formatting in comparison view (no line breaks, wrong styling)
6. Planner edit button collision with cell below
7. Can't remove a song from a planner cell (no clear/X button)

### Tier 2: Design System + Visual Polish (Phase 2)
8. Generate design.md with full token system
9. Audit and fix all hardcoded hex colors
10. Stitch redesign of 5 key pages
11. Apply Stitch designs
12. Fix overflow:hidden on html/body
13. Liturgical color corrections (Holy Thursday white, Easter Vigil burnt orange, Easter white+gold ring)
14. Psalm/antiphon text color system (burgundy for verbatim, gray-blue for synopses, light gray for citations)
15. Announcements redesign as community bulletin board

### Tier 3: Calendar Enhancements
16. Traditional monthly calendar view (in addition to agenda)
17. Week start preference (Monday default, Sunday option)
18. Day detail expansion view (click day for time-slot view)
19. iCal subscription import (external calendars with rename, toggle, cherry-pick)
20. Calendar permalink for others to subscribe
21. Print/export upcoming weeks as PDF
22. Patricia's priest schedule portal/form
23. Mini-map month navigation in toolbar

### Tier 4: Planner/Multi-Week Enhancements
24. Rename "Planner View" to "Multi-Week View"
25. Play button in grid cells
26. Sheet music preview button in grid cells
27. Director view vs. member view (read-only for non-directors)
28. Custom rows: Prelude, Homily Reflection, Post-Communion Meditation, Choral Anthem
29. Renameable slot labels in settings
30. Liturgical art images above occasion headers
31. Comparison view: director-only access for multi-occasion compare

### Tier 5: Song Selection Intelligence
32. Inline suggestions beneath assigned songs (with "weeks since" / "weeks until" data)
33. Slot-aware suggestion filtering (psalm slot = only psalms, etc.)
34. Bulk assignment: mass setting / GA for remainder of season or all 3 cycles
35. "See more" popover with explanation of why each song fits
36. Repetition slider for auto-populated plans

### Tier 6: Occasion/Season Fixes
37. Ordinary Time: sequential/chronological order (not parallel cycle A/B/C)
38. Nativity: add all Mass variants (Dawn, Day, etc.)
39. Solemnities → "Holy Days" (includes feast days, chronological)
40. Holidays section for civil holidays with music
41. Music indicator toggle (music note icon on events with music)

### Tier 7: Wedding Portal
42. Step-by-step wizard (10 steps from current Wedding Guide sheet)
43. Song database: 150+ curated songs with categories, instrumentation, audio, star ratings (✪), vocalist requirements (solo/duet, male/female/either), and "Together for Life" booklet cross-references for psalm/reading steps
44. Cantor selection with audio recordings
45. Wedding coordinator data entry (dates, contacts, rehearsal times)
46. Export: beautiful 8.5x11 PDF
47. AI FAQ chat for couples' questions

### Tier 8: Funeral Portal
48. Step-by-step wizard (14 steps from current Funeral Worksheet)
49. Song database: 200+ curated songs for funeral liturgy
50. OT and NT reading selections with pre-existing 3-line poetic summaries (already written in Funeral Worksheet source data; import as-is, fallback to AI generation only if missing)
51. Same cantor selection, export features as wedding
52. Gentle, white-glove UX for grieving families

### Tier 9: "Plan a Mass" Form
53. Dynamic questionnaire (mass type, celebrant, school divisions, readings)
54. Collaborative link (invite others to plan)
55. Custom reading entry with auto-synopsis generation
56. Participant fields (readers, gift bearers, ministers, sacristan)
57. Auto-populate calendar on completion

### Tier 10: Musician Management
58. Sub request system (cascading SMS to ordered sub list) with personnel-aware chart distribution (auto-send instrument-specific PDFs based on musician role/instrument)
59. Musician history lookup with date range filter
60. Invoice generation (PDF/DOCX export from booking history)
61. 2-week-out understaffed notifications
62. Mass assignment reminders (configurable SMS/email with per-musician opt-in granularity: notification type, frequency, channel preference)
63. Submissions portal for new musicians (screening + bench deepening)

### Tier 11: Onboarding (Multi-Parish)
64. Setup wizard: resources, favorites, parish personality, mass count
65. Auto-populate 3-year cycle based on readings + community preferences
66. Repetition feedback loop ("Are people singing? Adjust repetition")
67. Per-parish cloud storage for uploaded libraries
68. Custom ensemble names and colors per parish

### Tier 12: Existing Plan Items
69. Gospel Acclamation compound slot (P4-01)
70. Enriched Song Index with scripture refs, tags, tune, meter (P4-02)
71. Editable planning notes per occasion (P4-03)
72. Sheet music playback POC (P4-04)
73. V1 dead code cleanup (P1-05)
74. Accessibility: ARIA, keyboard nav, focus trapping, contrast (P3)
75. Quality gates: Vitest, Supabase types, web audit, PAL review (P5)

### Tier 13: Integrations
76. ProPresenter slide generation/sync via Dropbox **(v3.0 scope, research pending usage renewal)**
77. Copyright reporting automation (One License)
78. Mazevo space booking integration
79. forScore setlist export (.4ss files) with long-term goal of in-app web-based setlist viewer replacing iPad/forScore physical distribution workflow
80. Flocknote replacement (transition comms to app)

---

## 15. Gemini Deep Research Findings (3 of 6 complete)

### 15.1 AI Design Tools and App Redesign (Prompt 6)

**Source:** Google Doc "AI Design Tools and App Redesign"

**Key findings for our redesign workflow:**

1. **Stitch 2.0 is the right anchor tool.** Its DESIGN.md standard solves our biggest problem: maintaining visual consistency across 38 routes. DESIGN.md codifies palette roles, typographic hierarchies, and component behaviors into a deterministic source of truth that the AI must follow for every generated screen.

2. **Optimal 3-phase redesign workflow for existing apps:**
   - **Phase 1 (Spatial Analysis):** Upload screenshots of existing pages into Stitch's Experimental Redesign mode. Stitch reads spatial relationships (sidebar, grids, data columns) and applies new aesthetics while preserving functional layout.
   - **Phase 2 (Systematization):** Codify the approved aesthetic into DESIGN.md. Use multi-select iteration to apply global prompts across all screens simultaneously ("Align all routes to DESIGN.md typography, elevation, and spacing rules").
   - **Phase 3 (Last Mile):** Export to Figma for micro-interactions, precise developer handoff, and the subtle motion/polish AI can't generate.

3. **Tailwind v4 + DESIGN.md integration is native.** Stitch maps DESIGN.md tokens directly to `@theme` CSS variables in globals.css. Our existing `@theme inline` block is already the right architecture. Stitch MCP + Next.js MCP creates a synchronized conduit between design canvas and codebase.

4. **Dynamic liturgical theming architecture:** Use a single CSS variable `--liturgical-theme` on the root element, swapped by season. Then use `color-mix()` to derive subtle backgrounds: `bg-[color-mix(in_srgb,var(--liturgical-theme),transparent_90%)]`. Zero JS overhead for color calculations. This replaces our current scattered `SEASON_COLORS` and `LITURGICAL_COLOR_HEX` objects.

5. **Typography recommendation:** Pair a geometric sans-serif (Neue Montreal, Source Sans Pro, or League Spartan) for UI elements with a high-contrast serif (Editorial New, Libre Baskerville, or Hatton) for liturgical headers and scriptural text. This creates "sacred yet modern."

6. **Density philosophy:** Don't subtract data. Orchestrate it. Use contrast, grouping, and rhythm instead of removing information. Notion-style progressive disclosure. Linear-style spatial rigor. Figma-style structured improvisation. Background color shifts instead of divider lines.

7. **Drag-copy improvements:** When dragging, the source row should dim (not disappear), the dragged clone should elevate with shadow + slight rotation ("Trello standard"), and target drop zones should magnetically part to show a colored drop indicator. For copy (vs move), detect Alt/Ctrl key via `dragover` event's `altKey`/`ctrlKey` property and show a "+" icon.

8. **Media player architecture is correct.** Our existing pattern (player in root layout.tsx with React Context) is the recommended approach for persistent playback across routes. Visual refinement should add: compact/expanded modes, season-colored progress bar.

### 15.2 Church Volunteer Scheduling System Design (Prompt 5)

**Source:** Google Doc "Church Volunteer Scheduling System Design"

**Key findings for our sub-request and booking system:**

1. **SMS is non-negotiable for sub-requests.** 98-99% open rate, 90% read within 3 minutes, 45% response rate vs 8% for email. A 10-person cascade resolves in under 20 minutes via SMS vs 6+ hours via email.

2. **Sequential cascade beats broadcast.** Broadcast ("blast to all subs") triggers the bystander effect: 20 bassists get the text, each assumes someone else will respond. Sequential cascade contacts one at a time with a timeout window (15 min default, shortened for urgent requests).

3. **Proposed cascade architecture:**
   - Musician flags unavailability → system generates ordered candidate array (filtered by: same instrument, same mass, available date, seniority rank)
   - SMS to candidate #1 with accept/decline links → 15-min timeout → if declined or no response, advance to #2
   - On accept: database swap, confirmation SMS to new musician with setlist/charts links
   - On full exhaustion: urgent SMS to Music Director for manual intervention

4. **Seniority tiers matter.** Candidates should be ordered by skill tier (First Chair → Second Chair → Third Chair → General Pool). A complex arrangement shouldn't go to a novice just because they're next alphabetically.

5. **Hyper-urgent protocol (< 12 hours).** Timeout window shrinks to 5 minutes. Can run SMS + push notification simultaneously. Consider parallel cascade (contact top 3 simultaneously, first to accept wins).

6. **Payroll integration pattern:** ChMS marks attendance → webhook triggers invoice generation → auto-calculate based on pre-set rates → ACH transfer. For 1099 contractors, Zoho Invoice or similar generates and approves invoice automatically on "Attended" status.

7. **Planning Center's "Auto-Reschedule"** is the gold standard: on decline, system auto-queries for next best person OR generates a targeted signup sheet sent only to qualified members.

8. **Ministry Scheduler Pro's "subdivision" tagging** is relevant: tag musicians with specific skills (e.g., "bassist: electric only" vs "bassist: upright + electric"). Sub requests respect these tags.

### 15.3 Catholic Music Licensing Reporting Requirements (Prompt 2)

**Source:** Google Doc "Catholic Music Licensing Reporting Requirements"

**Key findings for automated copyright reporting:**

1. **Two licenses required for most Catholic parishes:**
   - **ONE LICENSE:** Covers GIA, OCP (including former LicenSing catalog), WLP, and hundreds of other liturgical publishers. ~28,000 active holders globally. Covers congregational reprints and streaming.
   - **CCLI:** Covers contemporary/CCM catalogs (Hillsong, Bethel, Elevation) PLUS OCP's Spirit & Song catalog. Required if using any contemporary worship music.

2. **Data our app must capture per song usage for ONE LICENSE:**
   - Song title, composer/author, copyright year, publisher
   - Date used, parish name, ONE LICENSE number
   - How it was used: reprint in worship aid, projected on screen, live-streamed, podcast/recorded

3. **Data our app must capture for CCLI:**
   - Song title, writer credits, CCLI Song Number
   - Date used, parish CCLI License Number
   - Usage type: projected, printed, streamed

4. **Critical legal constraint: Sheet music distribution to musicians.**
   - ONE LICENSE and CCLI reprint licenses do NOT cover distribution of choir parts, keyboard accompaniments, or instrumental parts. Only congregational melodies/text.
   - Scanning a physical octavo and emailing the PDF to the choir is **illegal**.
   - **OCP's digital library subscription** ($640-$1,300/yr) explicitly permits downloading and distributing PDFs of all parts to ensemble members. This is the legal solution for OCP content.
   - **GIA** sells digital downloads on a per-copy basis (buy qty 30 for a 30-person choir).

5. **Streaming requires separate licenses.** ONE LICENSE Podcast/Streaming License or CCLI Streaming License. Standard streaming covers live performance only, NOT commercial master recordings. Streaming Plus or Recorded Audio License needed for backing tracks.

6. **Attribution requirements are strict:**
   - CCLI: song title, writer credits, copyright notice, "Used by Permission", CCLI License #
   - ONE LICENSE: title, composer, copyright year, publisher, "Reprinted with permission under ONE LICENSE #A-[number]. All rights reserved."
   - Digital worship aids must NOT be posted on the open internet. Must be distributed via email list or password-protected website.

7. **Auto-reporting architecture:** Every time a song is assigned to an occasion in our app, we already have: song title, composer, publisher, date. We need to add: CCLI Song Number (to songs table), ONE LICENSE catalog flag, and usage type (reprint/project/stream). Annual report = `SELECT song_title, composer, publisher, COUNT(*) as times_used, usage_types FROM song_assignments WHERE date BETWEEN [year_start] AND [year_end] GROUP BY song_title`.

8. **Jeff's instinct to automate is correct and legally important.** Under-reporting = denying composers royalties = potential statutory damages ($750-$150,000 per work). FBI monitors IP theft. YouTube/Facebook auto-detect unlicensed streams.

### 15.4 Catholic Wedding Music Planning Tool Research (Prompt 3)

**Source:** Google Doc "Catholic Wedding Music Planning Tool Research"

**Key findings for our wedding portal design:**

1. **Together for Life integration is mandatory.** The booklet (9M+ copies sold) uses alphanumeric codes (A = Opening Prayer, B = OT Readings, C = Responsorial Psalms, D = NT Readings, E = Gospel Acclamation, F = Gospel). Priests rely on these codes to prepare their Missals. Our tool must use the same C1-C7 psalm coding system and map each code to specific musical settings with audio previews.

2. **Three liturgical judgments govern all music selection:**
   - **Liturgical:** Is the text doctrinally sound, scriptural, and appropriate for this moment in the rite?
   - **Musical:** Is the composition technically and aesthetically beautiful (not "cheap" or "trite")?
   - **Pastoral:** Will this music help THIS specific assembly pray and participate?
   - The tool should implicitly enforce these rather than presenting them as academic rules.

3. **"Constrained customization" is the UX paradigm.** The framework is rigidly locked to the Order of Celebrating Matrimony, but creative freedom exists within each slot. This is the opposite of secular platforms (Zola/Knot/Joy) which allow anything anywhere.

4. **Critical branching question at the start:** "Will the marriage be celebrated within a Nuptial Mass (with Eucharist) or as a Wedding Ceremony outside of Mass?" This dynamically shows/hides the entire Liturgy of the Eucharist section (Gifts, Mass Setting, Communion). Prevents liturgical errors.

5. **Progressive solemnity ordering:** The tool should require Mass settings and Responsorial Psalm selection BEFORE processional marches and supplementary hymns. The most important musical elements are acclamations (Sanctus, Memorial, Amen), then psalms, then hymns.

6. **Lenten auto-detection:** If the wedding date falls within Lent, the tool must automatically swap Alleluia options for Lenten acclamations and hide all Alleluia settings. Zero burden on the couple.

7. **Secular music handling (gentler than funeral):**
   - Couples conditioned by secular platforms expect "soundtrack" control.
   - Don't display error messages. Instead: "While popular love songs are wonderful for your reception dance floor, the music during your Nuptial Mass is a form of sacred prayer. Explore our curated library of timeless liturgical music."
   - Position the Church as a supportive guide, not a gatekeeper.

8. **Cantor selection as "liturgical minister selection" (not vendor booking):**
   - Feature a "Musician Directory" with: professional bio, voice type (Soprano/Alto/Tenor/Bass), high-fidelity audio samples of standard repertoire (Ave Maria, a chanted Psalm), and instrumentation options (trumpet, cello, string quartet, etc.).
   - Explain how acoustic dynamics work: "A soaring soprano carries in a reverberant stone basilica, while a warm baritone suits an intimate chapel."
   - First name + last initial for privacy (per Jeff's Brain Dump).

9. **Export packet must include 5 data sections:**
   - **Administrative:** Couple names, contacts, event date/time, rehearsal details, officiant
   - **Ministers/Party:** Headcount (bridesmaids, groomsmen, flower girls), lectors, gift bearers, EMHCs
   - **Liturgical selections:** Together for Life codes (A1, B2, C3, D8, E2, F4), vow format (memorized vs repeated), nuptial blessing choice
   - **Musical score:** Chronological mapping of every piece to liturgical moment, with composer, publisher, hymnal number
   - **Financial:** Itemized fee schedule (Church fee, Organist $200-250, Cantor $150-200, additional instruments $200+/player), payment status, external vendor approvals

10. **The C1-C7 psalm mapping table (from research, enriches our Wedding Guide sheet data):**

| Code | Psalm | Theme | Key Settings |
|------|-------|-------|-------------|
| C1 | Ps 33 | "The earth is full of the goodness of the Lord" | Haugen, Cotter, Guimont (GIA) |
| C2 | Ps 34 | "I will bless the Lord" / "Taste and see" | Moore, Keil, Guimont |
| C3 | Ps 103 | "The Lord is kind and merciful" | Haugen, Cotter, Modlin (OCP) |
| C4 | Ps 112 | "Blessed the man who greatly delights" | Alonso, LaRosa |
| C5 | Ps 128 | "Blessed are those who fear the Lord" | Haugen (Blest Are Those Who Love You) |
| C6 | Ps 145 | "How good is the Lord to all" | Chepponis, Gamba |
| C7 | Ps 148 | "Let all praise the name of the Lord" | Cotter |

### 15.5 Catholic Funeral Music Planning Guide (Prompt 4)

**Source:** Google Doc "Catholic Funeral Music Planning Guide"

**Key findings for our funeral portal design:**

1. **Grieving families are cognitively impaired.** Acute grief suppresses the prefrontal cortex (planning, decision-making) and amplifies the amygdala (emotional survival). Families planning funerals within 48-72 hours of death have severely diminished capacity for comparing abstract options, understanding complex rules, or processing multi-step forms. The tool MUST allow pause, save progress, and return later without penalty.

2. **Bereavement UX principles (non-negotiable):**
   - **Progressive disclosure:** One decision per screen. Never show the entire Mass structure at once.
   - **Visual calm:** Muted palette, soft grays/whites, generous whitespace, highly readable typography. No aggressive alerts, countdown timers, or transactional language.
   - **Curated choices over infinite scrolling:** Present 5-10 pre-approved options per step organized by emotional theme, not the entire parish hymnal.
   - **Collaborative grief:** Enable geographically dispersed family members to view options, listen to audio, and suggest music asynchronously via shared link.
   - **Empathetic scaffolding:** Explain WHY each part of the Mass exists ("to give voice to our grief") before asking for a selection.

3. **Secular music handling: the "instead of" mapping strategy.**
   - Families frequently request Wind Beneath My Wings, My Way, Danny Boy, Supermarket Flowers.
   - The liturgy strictly forbids secular music during the Mass (USCCB mandate: music must express the Paschal Mystery).
   - **Don't just say "no."** Validate the emotion, then offer: (a) a sacred alternative that evokes a similar feeling, and (b) placement options for secular music OUTSIDE the Mass (vigil/wake, cemetery procession, reception).
   - Build an "instead of" mapping: e.g., family wants "Wind Beneath My Wings" → suggest "On Eagle's Wings" (Joncas) for similar emotional arc within liturgical bounds.

4. **Most commonly requested/recommended funeral songs (from research):**
   - **Gathering:** Amazing Grace, Here I Am Lord, Be Not Afraid, How Great Thou Art, All Creatures of Our God and King
   - **Communion:** I Am the Bread of Life, On Eagle's Wings, Gift of Finest Wheat, Taste and See, One Bread One Body
   - **Song of Farewell:** In Paradisum (chanted), Song of Farewell (Grayson Warren Brown, Sarah Hart/LaRosa), May the Angels Be Your Guide
   - **Recessional:** Go In Peace (Sarah Hart), May the Angels Lead You Home, I Am the Bread of Life
   - **Spanish:** Pescador de Hombres, Resucitó, Entre Tus Manos, Hacia Ti Morada Santa

5. **Responsorial Psalm is the most theologically significant music choice.** The OCF strongly recommends it be SUNG, not recited. The tool should provide exegetical context for each psalm option ("Psalm 23 speaks to those who feel they are walking through darkness..."). Most common funeral psalms: Ps 23 (The Lord is my Shepherd), Ps 25 (To You O Lord I Lift My Soul), Ps 27 (The Lord is My Light), Ps 103 (The Lord is Kind and Merciful), Ps 116 (I Will Walk in the Presence of the Lord), Ps 130 (Out of the Depths).

6. **Edge cases requiring special UX paths:**
   - **Bilingual/Spanish:** Completely swap the music catalog. Use songs with short refrains or English/Spanish alternating verses. Latin refrains (Ubi Caritas, Panis Angelicus) as linguistic bridge. Side-by-side translation in worship aid exports.
   - **Children's funerals:** Strip all bureaucratic language. Gentle, soothing melodies only (Jesus Lead the Way, Be Still My Soul, Day Is Done). Lullaby-like settings of In Paradisum. Psalms pivot to divine embrace themes.
   - **Military/veteran:** American flag protocol (flag removed at church entrance, pall placed, flag re-draped after Mass). Military honors happen at cemetery, not during Mass. Tool must guide through the handoff protocol clearly.

7. **Four separate exports required (not one monolithic PDF):**
   - **Family keepsake:** Beautiful, calm, easy-to-read program with all selections, readings, and order of worship. A memento, not a logistics doc.
   - **Celebrant guide:** Readings, prayer options, special ritual notes (cremation? military?), family preferences.
   - **Musician packet:** Hymnal numbers, Mass setting, cantor vs. solo designations, key signatures, precise timing cues, audio reference links.
   - **Funeral home logistics:** Arrival times, casket type (metal vs. wood affects pall placement), urn vs. body, staging for procession, addresses and routes between church/cemetery/reception.

8. **The tool's highest calling:** "To comfort those who mourn, to uplift the brokenhearted, and to accompany the faithful with supreme dignity." This is not a form. It is an act of pastoral care.

### 15.6 Practice & Preparation Tools: Complete Technical Specification

**Sources:** "Digital Church Music Workflow Analysis" + "Church Musician Practice Tool Research" (Gemini Deep Research)

---

#### 15.6.1 The Problem We're Solving

Church musicians currently use 5-7 separate apps to prepare for Sunday:
- **Planning Center** for schedule/assignments
- **forScore** (iPad) for sheet music viewing and annotation
- **Dropbox** for file distribution
- **RehearsalMix** for part isolation / practice tracks
- **A metronome app** (Pro Metronome, Soundbrenner)
- **A pitch pipe or tuner app**
- **YouTube or publisher MP3s** for reference recordings

This fragmentation means: constant context-switching, manual file management, no transposition without re-purchasing charts, no part isolation for choral music, and the director spending hours every week assembling and distributing packets. Our app replaces ALL of this with a single, unified practice environment.

#### 15.6.2 The Vision: Saturday Night Practice Flow

A cantor preparing for Sunday opens the app on their phone at 9pm:

1. **My Assignments** screen shows: "Palm Sunday, 11:30am Mass, Elevations ensemble. 8 songs assigned."
2. Taps **"Ps 22: My God, My God"** (the responsorial psalm).
3. **Interactive notation renders** showing ONLY the cantor line (soprano melody with lyrics). The 4-part SATB choir arrangement exists in the system, but this musician sees only their part.
4. Taps the **play button**. A visual cursor begins moving across the notation, synchronized with audio playback. The cantor hears a high-quality reference recording (or synthesized MIDI if no recording exists).
5. The bridge modulation is tricky. She **drag-selects measures 24-32** and taps the **loop icon**. That section repeats. She enables **Speed Training**: the loop starts at 70% tempo and automatically increases 5% each repetition until full speed.
6. She wants to practice in a lower key. Taps the **key selector**: the entire score re-renders from E minor to D minor instantly. Audio pitch-shifts to match.
7. She's unsure about one interval. She **taps the note** on the staff. A clear, synthesized tone plays that exact pitch. She taps the next note. She hears the interval. She sings it back.
8. She toggles the **metronome**. A click track overlays the playback, perfectly synchronized to the beat.
9. She wants to hear how her part fits with the choir. She toggles **"Full Mix"** and the audio switches from cantor-only to the full SATB arrangement with her part slightly louder.
10. She marks a **breath mark** between measures 28 and 29 using the annotation tool. This annotation persists to her profile. Next time she opens this song, her marks are there.
11. She swipes to the next song. **"Jesus Christ Is Risen Today"** loads instantly. Same workflow.
12. She's done in 25 minutes. She closes the app knowing she's prepared.

#### 15.6.3 Technology Landscape Analysis

**Interactive Notation Platforms (comparison):**

| Platform | Architecture | Strengths | Limitations | Cost |
|----------|-------------|-----------|-------------|------|
| **SoundSlice** | Web embed (iframe), MusicXML/Guitar Pro/PDF OCR, audio sync via syncpoints | Best audio-sync in the market. Tempo stretch without pitch shift. Loop snap to barlines. Speed Training. Part isolation via stem muting. Dynamic transposition with instrument fingering aids. | Cross-origin iframe blocks tap-for-pitch and DOM annotation. White-label requires enterprise deal. | $100/mo for 200 users, $0.50/user overage |
| **OSMD** | Open-source TypeScript, MusicXML → SVG via VexFlow | Full DOM access (tap notes, annotate, custom events). Part isolation by hiding staves. Client-side transposition via TransposeCalculator. Responsive line-breaks for mobile. | No native audio playback. Must build audio sync layer on top. Complex to implement well. | Free (MIT license) |
| **abcjs** | Open-source JS, ABC notation → SVG | Built-in MIDI synthesis (CreateSynth). Lightweight. Great for lead sheets. External audio sync support. | ABC notation can't handle complex SATB or piano accompaniments. | Free (MIT license) |
| **Flat.io** | Cloud SaaS, proprietary renderer | Real-time multi-user collaboration (Google Docs for music). Google Classroom integration. | Primarily an editor, not a practice tool. Limited audio sync to external recordings. | Education pricing |
| **Noteflight** | Cloud SaaS, HTML5 | Hal Leonard partnership (legal arranging/monetization). Realistic VST playback. | Closed ecosystem. No embedding API for practice workflows. | Subscription |
| **Tomplay** | Native app + web | Studio-recorded orchestral backing tracks. "Wait Mode" (pauses until you play correct note). Time-stretch. | Limited transposition (only certain catalog titles). Closed catalog. | Subscription |
| **SmartMusic** | Cloud LMS | Algorithmic pitch/rhythm assessment. Huge educational repertoire. | Classroom-focused, not church worship. No custom upload. | Subscription |

**Audio/Playback Technology:**

| Technology | What It Does | Our Use |
|-----------|-------------|---------|
| **Web Audio API** | Low-level browser audio: oscillators, gain nodes, buffer sources, analyzers | Foundation for everything. Stem mixing, metronome, pitch detection |
| **Tone.js** | High-level Web Audio abstraction: synths, transport, scheduling | Tap-for-pitch (`synth.triggerAttackRelease("C4", "8n")`), metronome loop, global transport |
| **Web MIDI API** | Browser ↔ MIDI hardware (keyboards, controllers) | Optional: musicians with digital pianos can play along and get feedback |
| **Pitchy / Pitchfinder** | Vocal pitch detection via microphone (YIN algorithm, McLeod Pitch Method) | Future: cantor sings, app shows their pitch on the staff in real-time |
| **MediaDevices.getUserMedia()** | Microphone access in browser | Input for pitch detection |

**Distribution/Format Pipeline:**

| Format | Best For | Transposable? | Part Isolation? | Audio? |
|--------|----------|---------------|-----------------|--------|
| **PDF** (current) | Static viewing only | NO | NO | NO |
| **ABC Notation** | Lead sheets, melodies, psalm refrains | YES (abcjs.strTranspose) | NO (single staff) | YES (built-in MIDI synth) |
| **MusicXML** | Full scores, SATB, piano, orchestrations | YES (OSMD TransposeCalculator) | YES (hide/show staves) | Via external layer (Tone.js) |
| **ChordPro** | Rhythm section chord charts | YES (algorithmic) | N/A | NO |
| **Multi-track stems** (MP3/WAV) | Real audio part isolation | Via pitch-shift library | YES (gain node per stem) | YES (the audio itself) |

#### 15.6.4 Architecture Decision: Phased Approach

**V2 (ship with v2.0): SoundSlice Embed + Standalone Utilities**

The fastest path to a working practice experience. Offloads the hard problems (rendering, audio sync, tempo stretch) to SoundSlice's battle-tested infrastructure.

| Component | Implementation | Rationale |
|-----------|---------------|-----------|
| **Sheet music viewer** | SoundSlice iframe embed ($100/mo). Upload MusicXML per song. Sync to existing audio recordings via syncpoint editor. | Immediate access to: transposition, looping, speed training, tempo adjust, part isolation. No custom rendering code. |
| **Song assignment integration** | `/api/practice/[userId]` returns this week's assigned songs with SoundSlice `scorehash` IDs. Practice page queries this endpoint and renders a setlist of embeddable players. | Musicians see ONLY their assignments, not the whole library. |
| **Tap-for-pitch utility** | Standalone Tone.js keyboard component (outside iframe). Visual piano/chromatic strip. Tap any note to hear it. | Can't access DOM inside SoundSlice iframe, so this lives as a companion tool alongside the embed. |
| **Metronome** | Standalone Tone.js metronome with tap-tempo, subdivision selector, accent patterns, and setlist memory (save BPM per song). | Replaces Pro Metronome and Soundbrenner for basic use cases. |
| **Reference audio player** | Existing MediaPlayer component streams audio from Supabase storage. Link from practice page to MediaPlayer queue. | Musicians already have audio in the app. Just connect it to the practice flow. |
| **Offline access** | SoundSlice embeds support offline via their own caching. Metronome and pitch tool work offline natively (no network needed, pure Web Audio). | Saturday night practice works even with spotty connectivity. |

**V2 Data Model:**
```
songs table additions:
  - soundslice_scorehash (text, nullable) -- links to SoundSlice slice
  - musicxml_storage_path (text, nullable) -- Supabase storage path for MusicXML source file
  - abc_notation (text, nullable) -- ABC string for simple lead sheets
  - chordpro_text (text, nullable) -- ChordPro markup for rhythm charts
  - practice_tempo_bpm (integer, nullable) -- default practice tempo
  - recorded_stems (jsonb, nullable) -- array of { part: "soprano", storage_path: "..." }

practice_annotations table (new):
  - id (uuid, PK)
  - user_id (uuid, FK → profiles)
  - song_id (uuid, FK → songs)
  - annotation_data (jsonb) -- { marks: [{ measure: 28, type: "breath" }, ...], notes: "watch the Bb" }
  - created_at, updated_at
```

**V2 Routes:**
- `/practice` — My assignments for this week (list of songs with embedded players)
- `/practice/metronome` — Standalone metronome tool
- `/practice/pitch` — Tap-for-pitch keyboard

**V2 Limitations (honest):**
- Can't tap notes directly on the SoundSlice notation (cross-origin iframe security). The tap-for-pitch keyboard is a separate companion tool.
- Can't overlay microphone pitch detection on the notation.
- Annotations in SoundSlice are SoundSlice-native, not in our database (unless we use their API to manage).
- SoundSlice requires MusicXML upload per song. Initial catalog build is manual work.

**V2 Cost:** $100/mo SoundSlice Licensing (200 users). At 50+ musicians, that's $2/musician/month.

---

**V3 (post-v2.0): Proprietary OSMD Engine + Full Practice Suite**

Replace SoundSlice with our own rendering engine. Full DOM control enables every feature in the vision.

| Component | Implementation | What It Unlocks |
|-----------|---------------|-----------------|
| **OSMD renderer** | OpenSheetMusicDisplay (MIT license, TypeScript) renders MusicXML → SVG natively in our DOM. | Tap any SVG notehead to fire a Tone.js synth. Full annotation control. Custom styling matching our design system. |
| **Audio sync bridge** | Custom math layer maps OSMD pixel X-coordinates of every beat to Tone.js transport millisecond timestamps. Cursor moves fluidly across native DOM during playback. | Unified visual+audio experience. No iframe boundary. |
| **Part isolation (notation)** | OSMD's `setInstrumentVisible(index, false)` hides staves. Render only the parts relevant to the logged-in musician's instrument/voice type. | Bassist sees bass clef only. Soprano sees soprano only. Automatically determined from booking data. |
| **Part isolation (audio)** | Upload multi-track stems per song to Supabase storage. Load each stem into a separate `AudioBufferSourceNode` routed through individual `GainNode` modules. UI mixer: per-part volume sliders + solo/mute buttons. | "Isolate Alto" = gain on all other stems → 0. No baked-in click track problem (unlike RehearsalMix). |
| **Tap-for-pitch (on notation)** | Click event listener on SVG noteheads. Extract pitch metadata (e.g., "C4") from OSMD data model. `synth.triggerAttackRelease("C4", "8n")`. | The core interaction Jeff loves. Touch a note, hear it. |
| **Metronome (synced)** | Tone.js Transport recurring loop event. Percussive sample on every downbeat. Perfectly synced to the score's internal tempo. | Click track that follows the music, not a separate standalone. |
| **Transposition** | OSMD `TransposeCalculator` plugin. Set `osmd.sheet.Transpose = -2` (down a whole step). `osmd.updateGraphic()` + `osmd.render()`. Recalculates key signatures, accidentals, octave boundaries. | Director texts "can we do this in D instead of E?" Cantor opens the app, selects D, done. |
| **Speed Training** | Tone.js transport tempo ramp. Start loop at 70% BPM, increment 5% per iteration. | Builds muscle memory progressively, like SoundSlice's Speed Training but native. |
| **Annotation layer** | SVG overlay on OSMD output. Stylus/touch drawing (breath marks, dynamics, cuts). Stored in `practice_annotations` table per user per song. Non-destructive (original MusicXML untouched). | Personal markings persist. Next time you open the song, your marks are there. Director can also publish "suggested markings" to the whole ensemble. |
| **Vocal pitch detection** | `getUserMedia()` → `AnalyserNode` → YIN/McLeod algorithm (via Pitchy/Pitchfinder, or WebAssembly port for near-native speed). Plot detected fundamental frequency against OSMD staff in real-time. | Cantor sings, sees their pitch line on the notation. Flat? Sharp? Instant visual feedback. |
| **WebSocket ensemble sync** | Director opens "Rehearsal Mode." WebSocket server broadcasts page/measure position to all connected devices. Replaces forScore's Bluetooth "Cue" system. Works across all devices and browsers. | Entire band follows the director's position. No Apple ecosystem lock-in. |
| **PWA offline** | Service Worker caches OSMD/VexFlow/Tone.js bundles + MusicXML files + audio stems in IndexedDB. Full practice experience works offline. Annotations sync when back online. | Saturday night, airplane mode, still works. |

**V3 Data Model additions:**
```
songs table additions:
  - stem_tracks (jsonb) -- [{ part: "soprano", url: "...", channel: 0 }, { part: "alto", ... }]
  - syncpoints (jsonb) -- [{ measure: 1, beat: 1, timestamp_ms: 0 }, ...]

practice_sessions table (new, analytics):
  - id (uuid, PK)
  - user_id (uuid, FK)
  - song_id (uuid, FK)
  - started_at (timestamp)
  - duration_seconds (integer)
  - sections_looped (jsonb) -- [{ start_measure: 24, end_measure: 32, repetitions: 8 }]
  - tempo_used (integer)
  - key_used (text)
  - annotations_added (integer)

ensemble_sync_sessions table (new):
  - id (uuid, PK)
  - leader_user_id (uuid, FK)
  - mass_event_id (uuid, FK)
  - started_at (timestamp)
  - connected_devices (integer)
```

**V3 Routes:**
- `/practice` — My assignments (with native OSMD players instead of SoundSlice embeds)
- `/practice/[songId]` — Full-screen practice view for a single song
- `/practice/metronome` — Enhanced metronome with setlist sync
- `/practice/rehearsal` — Director's rehearsal mode (WebSocket leader)
- `/practice/analytics` — Director view: who practiced what, how much, which sections

**V3 Cost:** $0/mo for rendering (OSMD is MIT licensed). Storage costs for MusicXML + audio stems in Supabase. Dev investment: significant (custom audio sync bridge is the hardest engineering problem).

#### 15.6.5 Content Pipeline: Getting Music Into the System

The practice tools are only as good as the music data behind them. Here's how content flows in:

| Source | Format | Pipeline | Coverage |
|--------|--------|----------|----------|
| **Existing Finale/Dorico scores** | MusicXML export | Director exports MusicXML from notation software. Upload to Supabase. OSMD renders it. | St. Monica's full custom arrangement library (the "crown jewel" per Arielle) |
| **SmartScore OCR** | PDF → MusicXML | Scan published octavos. SmartScore converts to MusicXML (300 DPI TIFF required, per our existing learnings). Manual cleanup in Dorico. | Published choral music where MusicXML isn't available from publisher |
| **SoundSlice OMR** | PDF/PNG → SoundSlice slice | Upload scan directly to SoundSlice. Their OMR converts to interactive notation. V2 only (SoundSlice phase). | Quick-and-dirty conversion for V2 |
| **Publisher digital libraries** | PDF + MP3 | OCP's digital library provides downloadable PDFs and MP3 practice tracks. Import MP3s as reference audio. PDFs are fallback for songs without MusicXML. | Entire Breaking Bread / Spirit & Song catalog (with subscription) |
| **Director-recorded stems** | Multi-track WAV/MP3 | Director records SATB lines in GarageBand/Logic using MIDI keyboard. Export isolated stems. Upload to Supabase. | Custom practice tracks for songs without publisher stems |
| **ChordPro text** | Manual entry or import from OnSong/Planning Center | Rhythm section charts with embedded chords. Stored in `chordpro_text` column. Rendered with instant transposition. | Band charts for contemporary music |

**Initial catalog build (V2 launch):**
1. Upload MusicXML for the top 50 most-used songs at St. Monica (highest priority: upcoming Holy Week + Easter)
2. Upload existing audio recordings from Supabase storage as reference tracks
3. Sync to SoundSlice via Data API (programmatic batch upload)
4. Director reviews syncpoints for audio-notation alignment
5. Musicians get immediate access to practice tools for those 50 songs

**Scaling strategy:**
- Prioritize songs by usage frequency (recommendation engine data tells us which songs are used most)
- Batch-OCR published octavos via SmartScore pipeline (already built, per memory)
- Eventually: publishers provide MusicXML directly (GIA's Planner, OCP's Liturgy.com are moving this direction)

#### 15.6.6 Competitive Positioning

| Feature | Our V2 | Our V3 | RehearsalMix | forScore | SoundSlice |
|---------|--------|--------|-------------|----------|-----------|
| Integrated with liturgical assignments | YES | YES | Via PCO only | NO | NO |
| Part isolation (audio) | Via SoundSlice | Native mixer | YES (baked-in click) | NO | YES |
| Part isolation (notation) | Via SoundSlice | Native OSMD | NO | NO | YES |
| Transposition | Via SoundSlice | Native OSMD | Key selection at purchase | NO | YES |
| Tap note to hear pitch | Companion tool | Native on notation | NO | NO | NO |
| Metronome | Standalone | Synced to score | NO | NO | NO |
| Annotations | SoundSlice native | Our database (persistent) | NO | YES (best-in-class) | Limited |
| Vocal pitch detection | NO | YES (mic → staff) | NO | NO | NO |
| Ensemble sync | NO | WebSocket leader/follower | NO | Bluetooth "Cue" (Apple only) | NO |
| Offline | Partial | Full PWA | YES (app) | YES (app) | Limited |
| Works on Android | YES (web) | YES (web) | YES (app) | NO (Apple only) | YES (web) |
| Cost to parish | $100/mo | $0/mo (self-hosted) | Per-seat | $19.99/user | $100/mo |

**The moat:** RehearsalMix has stems but no notation. forScore has annotation but no playback. SoundSlice has everything but no church context. We unify all three AND know what songs each musician needs for this Sunday. That last part is the thing no one else can do.

#### 15.6.7 Open Technical Decisions

1. **SoundSlice vs. build native first?** SoundSlice at $100/mo gets us to market fast. But the iframe limitations (no tap-for-pitch on notation, no mic overlay) are real. If Jeff wants the full vision from day one, skip SoundSlice and invest in OSMD. Recommendation: SoundSlice for V2, OSMD for V3.

2. **MusicXML source management:** Where does the canonical MusicXML live? Supabase storage bucket with a `musicxml_storage_path` on the songs table? Or a dedicated S3 bucket? Recommendation: Supabase storage (already in our stack).

3. **Who builds the syncpoints?** SoundSlice has a visual syncpoint editor. For V3, we need our own. This is a time-intensive manual task per song. Can we automate with beat detection? Partially, but rubato passages (common in Catholic hymnody) will always need manual tuning.

4. **Practice track licensing:** Creating and distributing multi-track stems requires a Practice-Track License from ONE LICENSE or CCLI (per the licensing research). Our app must track this and ensure compliance.

5. **Stem recording workflow:** Who records the isolated SATB parts? The director (using MIDI keyboard + GarageBand)? A volunteer? AI synthesis from MusicXML? Recommendation: Start with synthesized audio from OSMD/Tone.js (free, instant), upgrade to director-recorded stems for high-priority songs.

6. **Apple Pencil / stylus annotation quality in browser:** forScore's annotation latency is ~14ms because it uses Apple's Metal API natively. Browser-based SVG annotation will be slower. Acceptable for breath marks and text notes, not for detailed musical calligraphy. Acceptable tradeoff?

### 15.7 Church SaaS Onboarding and Music Planning (Multi-Parish Architecture)

**Source:** Google Doc "Church SaaS Onboarding and Music Planning"

**Key findings for multi-parish scaling:**

1. **Multi-tenancy architecture recommendation: Row-level tenancy with hybrid silo for enterprise.**
   - Row-level (`tenant_id` column on every table) for the vast majority of parishes. Cost-efficient, scales to thousands.
   - Database-per-tenant silo for diocesan enterprise contracts or mega-parishes requiring guaranteed isolation.
   - Supabase Row Level Security (RLS) is the natural enforcement mechanism. We already use RLS.

2. **Pricing models that work for churches:**
   - **Per-seat pricing is toxic.** Churches rely on rotating volunteers. Per-seat forces credential sharing, destroying audit trails.
   - **Planning Center model:** Unlimited users, usage-based sliding scale per module (pay by number of active scheduled people, not seats).
   - **Tithe.ly model:** Flat-rate "all access" bundle ($119/mo regardless of church size). Predictable for church budget committees.
   - **Diocesan enterprise:** Volume discounts (up to 50% off) for diocese-wide adoption. Bishop mandates the stack, instantly acquires hundreds of parishes.
   - **Freemium loss leader:** Core planning free, premium features (practice tools, streaming compliance, advanced analytics) paid.

3. **Onboarding success/failure patterns:**
   - **Failure:** Assuming volunteers will intuitively grasp complex software. No mandatory training. "Garbage in, garbage out" from legacy data import without audit.
   - **Success:** Demonstrate undeniable value in the FIRST session. Tithe.ly uses a gamified 6-step widget with visual progress tracking and a Starbucks gift card reward for completing setup within 30 days.
   - **Time-to-Value (TTV) is the critical metric.** If a music director doesn't see a populated plan within 30 minutes, they churn.

4. **The sub-60-minute onboarding wizard (4 phases):**
   - **Phase 1 (Profile):** Parish size, number of weekend masses, ensemble composition per mass (SATB choir at 9am, acoustic band at 11am, cantor-only at 5pm). Select physical hymnals from visual database (Breaking Bread, Gather 4, Ignatius Pew Missal). Link CCLI/OneLicense credentials via OAuth.
   - **Phase 2 (Taste):** "Pick 5 gathering songs your community loves." "Pick 5 communion songs." This seeds the recommendation engine's familiarity model.
   - **Phase 3 (Generate):** Algorithm maps the 3-year lectionary cycle to the parish's available catalog. Applies scripture matching, seasonal rules, and familiarity weighting. Generates a complete 156-week plan in seconds.
   - **Phase 4 (Refine):** Director reviews the generated plan, swaps songs they don't like, adjusts the repetition slider, and approves. Done. Full 3-year plan in under an hour.

5. **Content isolation model:** Each parish maintains its own song database. No globally shared copyrighted music library (liability). Parishes populate their catalog via API integrations with CCLI SongSelect, OCP/ICR, GIA. The platform knows the contents of standard hymnals (Breaking Bread, Gather 4) and can pre-map them.

6. **Diocesan hierarchical data model:** Local parish data is isolated from peer parishes BUT transparent to the diocesan level. Financial, census, and compliance data aggregates upward. This mirrors Catholic ecclesiology. ParishSOFT's architecture is the reference model.

7. **Legacy data migration:** The biggest onboarding killer. Solution: use the new system's communication tools to execute a "re-census" where parishioners update their own info via self-service portal, rather than trusting imported legacy data.

---

## 16. Intelligent Agent Backend Architecture (v2.0 Enhancement)

To deliver the advanced intelligent capabilities outlined throughout this specification — particularly the interactive practice tools suite, dynamic recommendation engine, sub-request orchestration, collaborative planning flows, wedding/funeral portals, and multi-parish scalability — the application should incorporate a robust, production-grade AI agent runtime layer.

### 16.1 Core Architectural Patterns to Adopt

The following patterns will significantly strengthen the intelligent features:

1. **Conversation Runtime & Multi-Turn Orchestration**
   Implement a `ConversationRuntime` that cleanly manages full user → assistant → tool → result loops, including turn summaries, cumulative usage tracking, and built-in support for multi-turn reasoning. This directly enables reliable sub-agent handoff ("Plan a Mass" wizard), long-running collaborative planning sessions, and the sequential sub-request cascade system.

2. **Flexible Permission Policy & Safety Layer**
   Introduce a configurable `PermissionPolicy` with modes (Allow / Prompt / Deny), tool-specific overrides, and an interactive prompter interface. This is essential for safely handling musician sub-requests, compliance document uploads, copyright reporting automation, and sensitive wedding/funeral data operations.

3. **MCP-Style External Tool Server Integration**
   Use a Model Context Protocol (MCP)-style client supporting stdio, remote, and OAuth transports to connect to specialized external tool servers. This architecture makes the interactive notation suite (real-time cursor synchronization, tap-for-pitch on staff, vocal pitch detection overlay, per-part audio isolation, and ensemble WebSocket sync) maintainable and extensible.

4. **Token-Aware Session Compaction**
   Integrate intelligent session compaction that preserves recent context verbatim while summarizing older history based on estimated token usage. This is critical for maintaining coherent state across long-running planning sessions, 3-year lectionary cycles, and the multi-week planner without exceeding context limits.

5. **Skill & Sub-Agent Tooling**
   Add first-class `Skill` (dynamic loading of instruction files such as practice guides or cantor briefs) and `Agent` (sub-agent launch with persistent handoff metadata) tools. This enables specialized sub-agents for wedding vs. funeral vs. regular Sunday planning flows.

6. **Layered Runtime Configuration**
   Adopt a layered configuration system (user / project / local scoping) with typed tool server definitions and OAuth support. This provides clean multi-parish tenancy while allowing per-parish customization of recommendation weights, repetition preferences, and permission defaults.

### 16.2 Recommended Implementation Approach

- Introduce dedicated `runtime/` and `tools/` packages to serve as the intelligent core of Ritual Song.
- For v2.0–v2.1, implement the runtime in TypeScript (aligning with the existing Next.js/React/Supabase stack) to minimize toolchain overhead and maximize development velocity.
- Reserve Rust (via WebAssembly) for v3.x performance-critical components only:
  - Real-time vocal pitch detection (YIN/McLeod algorithm running on microphone input at ~60 Hz).
  - Optional low-latency audio sync bridge if client-side JavaScript proves insufficient for sub-millisecond cursor tracking on complex scores.
- This hybrid approach keeps short-term velocity high while providing a clear path to native performance where it matters most.

### 16.3 Integration Points with Existing Features

| Spec Section | Runtime Component | How It Connects |
|--------------|-------------------|-----------------|
| 15.6 Practice Tools | MCP client + OSMD/abcjs integration | Connects notation rendering, tap-for-pitch, vocal pitch detection, part isolation, and ensemble sync as external tool servers. |
| 11.11 Musician Management | ConversationRuntime + PermissionPolicy | Powers the sequential SMS sub-request cascade with seniority tiers and timeouts. |
| 11.3 / 11.5 Song Selection | Session compaction + prompt construction + usage tracking | Enables scripture-aware, familiarity-weighted recommendations with "weeks since / until" metadata. |
| 11.1 / 15.7 Multi-Parish Scaling | Layered RuntimeConfig + MCP OAuth | Provides secure per-parish isolation with diocesan-level aggregation. |
| 7.3 Planning Notes | ConversationRuntime turn summaries | Persists and surfaces per-admin planning notes across sessions. |

### 16.4 Phased Delivery

- **v2.0**: Core runtime (ConversationRuntime, PermissionPolicy, basic MCP client, layered config) + Skill/Agent tooling.
- **v2.1**: Full integration with practice tools (notation + audio) and recommendation engine.
- **v3.x**: Rust WebAssembly modules for pitch detection and advanced audio sync.

Incorporating these patterns will accelerate delivery of Tiers 5–9 while establishing a secure, maintainable, and highly capable intelligent foundation for the entire platform.

---

## 17. Recommendations (20 decisions, positions taken)

Each item has a recommendation and a one-line rationale. Override any of these. That's the point.

### Design

| # | Decision | Recommendation | Why |
|---|----------|---------------|-----|
| 1 | Easter color | **#D97706 (amber-600)**. Differentiate from Christmas. | Two major seasons sharing one hex is a data visualization failure. Easter gold should feel warmer and more triumphant than Christmas gold. |
| 2 | Easter Vigil bullet | **#C2410C (burnt orange)**. Fire/ember of the paschal candle. | Jeff called this one. It's liturgically evocative and visually bridges Good Friday red → Easter gold. |
| 3 | Fonts | **Add web fonts: Inter (sans) + Lora (serif)**. Keep Trebuchet/Garamond as fallbacks. | System fonts are fast but unpredictable across platforms. Inter is the most legible UI font on earth. Lora has the warmth of Garamond with reliable cross-platform rendering. Load via `next/font/google` (zero layout shift). |
| 4 | V1 calendar code | **Delete entirely.** Move SeasonAlert to `components/ui/`, extract `getEnsembleColor` to shared util, nuke the rest. | Dead code is technical debt that confuses every future session. The redirect at `/calendar-v2` handles old links. No one is using V1. |
| 5 | Overflow fix timing | **Do it in Phase 2 (design system), but NOT during Holy Week.** Ship the fix the Monday after Easter (April 6). | The fix is necessary for iOS Safari and natural scroll. But breaking layout during Holy Week, when the app is most used, is reckless. |
| 6 | App name | **Keep "Ritual Song" for now.** Rebrand when multi-parish ships (v3.0). | Naming is a marketing decision, not an engineering one. Don't burn cycles on it until there's a product to market. The current name works for St. Monica. |

### Features

| # | Decision | Recommendation | Why |
|---|----------|---------------|-----|
| 7 | Wedding/Funeral portals | **Design-only in v2.0 (Stitch screens). Build in v3.0.** | The Gemini research makes these portals genuinely complex (bereavement UX, Together for Life integration, 4-export architecture). Rushing the build would produce something mediocre. Design them beautifully now, build them right later. |
| 8 | Plan a Mass form | **v3.0.** | It's a massive new surface area with collaborative features, notification systems, and calendar integration. Trying to ship this alongside the design system overhaul guarantees both are half-baked. |
| 9 | Multi-parish onboarding | **v3.0.** The onboarding wizard requires a recommendation engine, hymnal catalog database, and tenant isolation. None of these exist yet. | Build the product for St. Monica first. Validate it. Then scale. |
| 10 | Sub request system | **v3.0, separate feature branch.** | The SMS cascade architecture is well-spec'd (Gemini research), but it requires Twilio webhook infrastructure, ordered sub lists, seniority logic, and fallback protocols. It's a standalone product feature, not a v2 polish item. |
| 11 | ProPresenter integration | **v3.0. Deferred. Research pending.** | Jeff already called this. Usage renewal needed for the Gemini prompt. Park it. |
| 12 | Patricia's priest schedule | **Build as a simple admin form within the calendar, v2.1.** | It's a form that writes to `mass_events.celebrant`. Not a separate portal. Don't over-engineer it. |

### Data

| # | Decision | Recommendation | Why |
|---|----------|---------------|-----|
| 13 | Wedding/Funeral song import | **Yes. Import all 350+ songs into the songs table now with `ceremony_types` tag.** Even before the portals exist. | The songs enrich the library, search, and recommendation engine immediately. The `ceremony_types` column is already in the enrichment spec. Zero downside. |
| 14 | Ordinary Time sorting | **Chronological within each cycle year.** Not collapsed across cycles. | Jeff was clear: "I would rather they be in sequential order so Thanksgiving lives wherever it lives in a year view." Cycle A/B/C parallel view is confusing for planning. |
| 15 | Sheet music POC song | **"On Eagle's Wings" (Joncas).** | Most-used song at St. Monica. Everyone knows it. If the POC works for this song, it works for anything. Has MusicXML available from OCP digital library. |
| 16 | Library wipe and reimport | **After v2.0 design work, before v2.0 ships.** Target late April. | The fresh OCP/S&S downloads are ready. The duplicate detection is flagging false positives on GA verses. A clean import with the new `ceremony_types`, `languages`, and enrichment columns is the right move, but don't do it mid-design-system work. |
| 17 | Planning notes | **Per-admin private, with an option to "share with team" per note.** | Default private respects that directors have opinions they're not ready to broadcast. But a "pin to occasion" toggle lets them share specific notes when ready. Best of both worlds. |

### Operational

| # | Decision | Recommendation | Why |
|---|----------|---------------|-----|
| 18 | SMS consent fix | **Debug now (Tier 1 bug fix).** Likely an opt-in flow issue, not Twilio config. | Screenshots show "no consent/contact" for both recipients. Check: do Jeff's test profiles have `sms_consent: true` in the profiles table? If not, the onboarding flow isn't setting it. 15-minute fix once diagnosed. |
| 19 | Copyright automation | **Add `ccli_song_number` and `one_license_catalog` columns to songs table in v2.0. Build the report generator in v2.1.** | The data capture is trivial (two columns). The report is a SQL query. But validating the report format against ONE LICENSE and CCLI's actual submission portals requires testing with real credentials. Capture the data now, build the export later. |
| 20 | Musician rate master list | **Supabase `musician_rates` table with admin-only UI, v2.1.** | Columns: `profile_id`, `rate_type` (per_mass, per_event, hourly), `amount`, `effective_date`. Admin page under `/admin/rates`. Feeds the invoice generation feature in v3.0. |
