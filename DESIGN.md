# Ritual Song — Design System

> A missal meets Linear. Sacred content, power-user density, zero wasted pixels.

---

## Identity

**App:** Ritual Song — Liturgical music planning for Catholic parishes
**Aesthetic:** Warm parchment meets clean tooling. Editorial serif warmth. Data-dense SaaS clarity.
**Not:** Cold clinical SaaS. Not airy marketing site. Not dark-mode-first. Not playful.

---

## Color System

### Brand

| Token | Value | Role |
|-------|-------|------|
| `--color-parish-gold` | `#B8A472` | Accent: sidebar active state, nav highlight, premium moments |
| `--color-parish-burgundy` | `#800000` | Action: CTA buttons, links, admin actions |
| `--color-parish-charcoal` | `#3A3A3A` | Text: headings on light backgrounds |

### Neutrals

| Token | Value | Role |
|-------|-------|------|
| `--color-background` | `#fafaf9` | Page background (warm stone, never cold white) |
| `--color-foreground` | `#1c1917` | Primary text |
| `--color-surface` | `#ffffff` | Cards, panels, elevated surfaces |
| `--color-border` | `#e7e5e3` | Borders, dividers (whisper, not shout) |
| `--color-muted` | `#a8a29e` | Placeholder text, disabled states |
| `--color-subtle` | `#f5f5f4` | Hover backgrounds, zebra stripes |
| `--color-sidebar` | `#1c1917` | Sidebar background (the one dark anchor) |
| `--color-sidebar-text` | `#fafaf9` | Sidebar text |

### Liturgical Seasons

These are NOT decorative. They are data. Each color communicates theological meaning.

| Token | Value | Season | Vestment |
|-------|-------|--------|----------|
| `--color-advent` | `#6B21A8` | Advent | Violet |
| `--color-christmas` | `#CA8A04` | Christmas | White/Gold |
| `--color-lent` | `#581C87` | Lent | Violet (deeper) |
| `--color-holyweek` | `#7F1D1D` | Holy Week | Red |
| `--color-easter` | `#D97706` | Easter | Gold/Amber |
| `--color-ordinary` | `#166534` | Ordinary Time | Green |
| `--color-solemnity` | `#991B1B` | Solemnities | Red |
| `--color-feast` | `#B91C1C` | Feasts | Red |
| `--color-rose` | `#DB2777` | Gaudete/Laetare | Rose |

### Dynamic Liturgical Theming

The app adapts its accent color to the current liturgical season. A single CSS variable controls this globally:

```css
:root {
  --liturgical-theme: var(--color-ordinary); /* default */
}
```

Season is set programmatically on `<html>` based on the current date. All liturgical accents derive from this single variable using `color-mix()`:

```css
/* 10% tint for card backgrounds */
bg-[color-mix(in_srgb,var(--liturgical-theme),transparent_90%)]

/* 20% tint for hover states */
bg-[color-mix(in_srgb,var(--liturgical-theme),transparent_80%)]

/* 50% for borders */
border-[color-mix(in_srgb,var(--liturgical-theme),transparent_50%)]

/* Full color for text and icons */
text-[var(--liturgical-theme)]
```

This means: during Advent, cards get a 10% purple tint. During Lent, a deeper violet. During Easter, warm amber. Zero JavaScript. Pure CSS. Automatic.

### Vestment Day Colors

For calendar day-level indicators (the colored dot showing what the priest wears):

| Token | Value | Day type |
|-------|-------|----------|
| `--color-vest-violet` | `#6B21A8` | Advent/Lent weekdays |
| `--color-vest-white` | `#D4A017` | Solemnities, feasts of Christ (rendered gold for visibility) |
| `--color-vest-red` | `#B91C1C` | Martyrs, Pentecost, Palm Sunday, Good Friday |
| `--color-vest-green` | `#166534` | Ordinary Time |
| `--color-vest-rose` | `#DB2777` | Gaudete Sunday, Laetare Sunday |
| `--color-vest-black` | `#1C1917` | All Souls, Good Friday (optional) |

### Semantic Colors

| Token | Value | Use |
|-------|-------|-----|
| `--color-success` | `#16a34a` | Confirmed bookings, valid |
| `--color-warning` | `#d97706` | Needs attention, understaffed |
| `--color-error` | `#dc2626` | Errors, declined, missing |
| `--color-info` | `#2563eb` | Links, informational |

---

## Typography

### Font Stack

| Role | Font | Fallback | Use |
|------|------|----------|-----|
| **Sans** | Inter | Trebuchet MS, Helvetica Neue, sans-serif | UI chrome, navigation, data tables, metadata, controls |
| **Serif** | Lora | Garamond, Georgia, Times New Roman, serif | Liturgical headers, occasion titles, readings, scripture, psalm text |

### Scale

| Token | Size | Weight | Font | Use |
|-------|------|--------|------|-----|
| `display` | 28px / 1.75rem | 300 light | Serif | Month headers in calendar ("MARCH 2026") |
| `heading-1` | 22px / 1.375rem | 600 semi | Serif | Page titles, occasion names |
| `heading-2` | 18px / 1.125rem | 600 semi | Serif | Section headers, season names |
| `heading-3` | 15px / 0.9375rem | 600 semi | Sans | Card titles, subsections |
| `body` | 14px / 0.875rem | 400 regular | Sans | Default text |
| `body-sm` | 13px / 0.8125rem | 400 regular | Sans | Secondary text, metadata |
| `caption` | 11px / 0.6875rem | 500 medium | Sans | Tags, badges, timestamps |
| `micro` | 9px / 0.5625rem | 500 medium | Sans | Version string, least-priority metadata |

### Typography Rules

- Liturgical text (occasion names, readings, psalm refrains, antiphons) always uses **serif**.
- UI text (buttons, labels, metadata, navigation, filters) always uses **sans**.
- Verbatim liturgical text (actual psalm refrain wording, antiphon text, GA verse) is colored **burgundy** (`--color-parish-burgundy`).
- Scripture citations (e.g., "Ps 122:1-2, 3-4") are **light gray** (`--color-muted`), not bold.
- Reading synopses are **dark gray-blue** (`#374151`, gray-700), not black.

---

## Spacing

4px grid. Tailwind defaults.

| Context | Value | When |
|---------|-------|------|
| Page padding | `p-4 md:p-6` | All pages |
| Card interior | `p-4` | Inside every card |
| Card gap | `gap-3` | Between cards in a list/grid |
| Section gap | `space-y-6` | Between major page sections |
| Inline gap | `gap-2` | Badges, chips, button groups |
| Tight gap | `gap-1` | Icon + label pairs |

---

## Elevation

| Level | Use | Implementation |
|-------|-----|----------------|
| 0 | Page background | `bg-background` (`#fafaf9`) |
| 1 | Cards, panels | `bg-surface border border-border rounded-lg shadow-sm` |
| 2 | Modals, overlays | `bg-surface rounded-xl shadow-xl` + `bg-stone-900/50` backdrop |
| 3 | Tooltips, popovers | `bg-foreground text-sidebar-text rounded-md shadow-lg` (inverted) |

---

## Component Patterns

### Card
```
bg-white border border-stone-200 rounded-lg shadow-sm
```
Interactive hover: `hover:shadow-md hover:border-stone-300 transition-shadow duration-150`

Season-tinted card: `bg-[color-mix(in_srgb,var(--liturgical-theme),transparent_90%)] border border-[color-mix(in_srgb,var(--liturgical-theme),transparent_70%)]`

### Badge — Liturgical
```
inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide uppercase
```
Color derived from season: `bg-[color-mix(in_srgb,var(--color-{season}),transparent_85%)] text-[var(--color-{season})]`

### Badge — Status
```
inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
```
- Confirmed: `bg-green-50 text-green-700`
- Pending: `bg-amber-50 text-amber-700`
- Declined: `bg-red-50 text-red-700`

### Button — Primary
```
px-4 py-2 rounded-lg bg-parish-burgundy text-white font-medium text-sm
hover:bg-parish-burgundy/90 active:bg-parish-burgundy/80 transition-colors
```

### Button — Secondary
```
px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium text-sm
hover:bg-stone-50 transition-colors
```

### Button — Ghost
```
px-3 py-1.5 rounded-md text-stone-600 text-sm
hover:bg-stone-100 transition-colors
```

### Modal
```
Backdrop: fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center
Panel:    bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6
```

### Slide Panel
```
fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-40
transform transition-transform duration-200
```

### Input
```
w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm
focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold
placeholder:text-stone-400
```

### Select
```
px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm pr-8
focus:outline-none focus:ring-2 focus:ring-parish-gold/50 focus:border-parish-gold
```

### Table Row
```
border-b border-stone-100 hover:bg-stone-50 transition-colors
```

---

## Universal Ombre Header

Every page in the app opens with a gradient wash that fades from the contextual color into the parchment background. This is the single most unifying visual pattern in the design system. It communicates season, creates warmth without weight, and ties every page into one product.

### Implementation

```css
/* Applied to the header/hero section of every page */
bg-gradient-to-b from-[color-mix(in_srgb,var(--ombre-source),transparent_90%)] to-background
```

The `--ombre-source` variable defaults to `var(--liturgical-theme)` but can be overridden per page context.

### Per-Page Ombre Rules

| Page | Ombre Source | Reasoning |
|------|-------------|-----------|
| Dashboard (`/`) | `var(--liturgical-theme)` — current season | Director opens the app, immediately sees where they are in the Church year |
| Calendar (`/calendar`) | `var(--liturgical-theme)` — current season, resets at each month header | Month transitions feel like turning a page |
| Song Library (`/library`) | `var(--color-parish-gold)` at 15% | Library is a universal tool, not seasonal. Gold = brand accent, not liturgical data. |
| Occasion Detail (`/occasion/[id]`) | That occasion's season color | Palm Sunday = red wash. Easter = amber. Advent = purple. The occasion tells you its season. |
| Multi-Week View (`/planner`) | `var(--liturgical-theme)` — applied to column headers | Column headers carry the season; grid cells use the subtler 8% tint |
| Today (`/today`) | `var(--liturgical-theme)` — current season | Morning briefing feel. Today's liturgical identity front and center. |
| Wedding Portal (v3.0) | `var(--color-parish-gold)` | Celebratory. Gold = joy, not liturgical specificity. |
| Funeral Portal (v3.0) | `var(--color-muted)` at 30% — stone-400 | Intentionally desaturated. No bright colors. Visual calm for grieving families. Per bereavement UX research. |
| Auth/Gate pages | None | Clean. No chrome. Parish logo + input. |

### Gradient Depth

- **Standard pages:** 90% transparency (10% color). Subtle. Just enough to tint.
- **Hero sections** (Dashboard, Today, Occasion Detail): 85% transparency (15% color). Slightly more presence.
- **Funeral portal:** 70% transparency (30% stone-400). Noticeably muted. Deliberate calm.

The ombre always fades to `var(--color-background)` (#fafaf9, warm parchment). Never to pure white. Never to a different color. The destination is always home.

---

## Layout Architecture

- **Sidebar:** Fixed left, 16rem (256px) desktop, slide-over mobile. Dark (`#1c1917`). Gold active indicator.
- **Main content:** `overflow-auto` within the `main` element. Natural document scroll (no `overflow:hidden` on body).
- **Media player:** Sticky bottom bar, 48px compact / expandable for full controls. Season-colored progress bar.
- **Full-screen pages** (gate, auth, join, onboard): bypass the sidebar/player chrome entirely.

---

## Motion

Almost none. 150ms max. Only for spatial orientation:
- Sidebar collapse/expand
- Modal enter/exit (fade + scale)
- Slide panel enter/exit (translateX)
- Scroll-to-today on calendar load
- Focus ring transitions

No gratuitous animation. No loading spinners that bounce. No hover effects that move elements.

---

## Density Philosophy

This is a power-user tool. Music directors juggle 50+ occasions per season.

1. **Orchestrate, don't subtract.** High density is a feature. Uncurated density is the problem. Use contrast, grouping, and visual rhythm to make dense screens readable.
2. **Background color shifts instead of divider lines.** Zones, not borders.
3. **Progressive disclosure.** Show the minimum for scanning. Expand on click/hover. Occasion cards show title + date + season badge. Click reveals readings, resources, recommendations.
4. **Don't fear scrolling.** Vertically scrolling a list is more efficient than cramming everything into tiny internal panels.
5. **Serif for sacred, sans for utility.** This typographic contrast IS the information hierarchy.

---

## Tailwind v4 @theme Implementation

```css
@import "tailwindcss";

@theme inline {
  /* Brand */
  --color-parish-gold: #B8A472;
  --color-parish-burgundy: #800000;
  --color-parish-charcoal: #3A3A3A;

  /* Neutrals */
  --color-background: #fafaf9;
  --color-foreground: #1c1917;
  --color-surface: #ffffff;
  --color-border: #e7e5e3;
  --color-muted: #a8a29e;
  --color-subtle: #f5f5f4;
  --color-sidebar: #1c1917;
  --color-sidebar-text: #fafaf9;

  /* Liturgical seasons */
  --color-advent: #6B21A8;
  --color-christmas: #CA8A04;
  --color-lent: #581C87;
  --color-holyweek: #7F1D1D;
  --color-easter: #D97706;
  --color-ordinary: #166534;
  --color-solemnity: #991B1B;
  --color-feast: #B91C1C;
  --color-rose: #DB2777;

  /* Vestment day colors */
  --color-vest-violet: #6B21A8;
  --color-vest-white: #D4A017;
  --color-vest-red: #B91C1C;
  --color-vest-green: #166534;
  --color-vest-rose: #DB2777;
  --color-vest-black: #1C1917;

  /* Semantic */
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #2563eb;

  /* Dynamic liturgical theme (set programmatically) */
  --liturgical-theme: var(--color-ordinary);

  /* Typography */
  --font-sans: "Inter", "Trebuchet MS", "Helvetica Neue", sans-serif;
  --font-serif: "Lora", "Garamond", "Georgia", serif;
}

:root {
  color-scheme: light;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```
