/**
 * Spacing and layout tokens for print worship aids.
 * All values in mm. Page dimensions for half-letter (7" x 8.5") default.
 */

// Page margins (mm)
export const MARGINS = {
  top: 15,
  bottom: 15,
  inner: 20,     // Gutter side (toward binding)
  outer: 12,
} as const;

// Computed live area from half-letter (177.8 x 215.9 mm)
export const LIVE_AREA = {
  width: 145.8,   // 177.8 - 20 - 12
  height: 185.9,  // 215.9 - 15 - 15
} as const;

// Element spacing (mm)
export const SPACING = {
  xs: 1.5,      // Hairline gap
  sm: 3,        // Between copyright lines
  md: 5,        // Between elements within a group
  lg: 8,        // Between groups/sections
  xl: 12,       // Major section breaks
  xxl: 20,      // Cover page top padding
} as const;

// Season bar dimensions (mm)
export const SEASON_BAR = {
  width: 3,          // Vertical bar on left edge
  fullWidth: 177.8,  // Horizontal bar across top/bottom
  height: 2.5,       // Horizontal bar thickness
} as const;

// Divider defaults (mm)
export const DIVIDER = {
  strokeWidth: 0.3,
  paddingY: 4,       // Vertical padding above/below
} as const;

// Copyright footer zone (mm from bottom)
export const COPYRIGHT_ZONE = {
  y: 200,         // Start of copyright area (mm from top)
  height: 15.9,   // Remaining space to bottom margin
  lineHeight: 2.8, // mm per line of copyright text
} as const;
