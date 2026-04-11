/**
 * Typography tokens for print worship aids.
 * All sizes in pt (points). Minimum 7pt per elderly readability requirement.
 * Font stack: Crimson Pro (body/lyrics) + Source Sans 3 (headers/rubrics).
 */

export const FONT_FAMILIES = {
  body: "'Crimson Pro', Georgia, serif",
  heading: "'Source Sans 3', 'Helvetica Neue', sans-serif",
  rubric: "'Source Sans 3', 'Helvetica Neue', sans-serif",
} as const;

export const FONT_SIZES = {
  h1: 24,       // pt -- occasion title on cover
  h2: 18,       // pt -- section headers (Liturgy of the Word)
  h3: 14,       // pt -- song titles, reading labels
  h4: 12,       // pt -- sub-headers
  body: 10,     // pt -- lyrics, prayer texts, readings
  caption: 8,   // pt -- rubric instructions, response labels
  copyright: 7, // pt -- NEVER below 7pt
} as const;

export const LINE_HEIGHTS = {
  tight: 1.15,    // song lyrics, compact layouts
  normal: 1.35,   // body text, readings
  relaxed: 1.5,   // large text, cover page
} as const;

export const FONT_WEIGHTS = {
  light: 300,
  regular: 400,
  semibold: 600,
  bold: 700,
} as const;

export const LETTER_SPACING = {
  tight: -0.01,     // em -- headings
  normal: 0,        // em -- body
  wide: 0.05,       // em -- small caps, labels
  extraWide: 0.12,  // em -- section divider labels
} as const;
