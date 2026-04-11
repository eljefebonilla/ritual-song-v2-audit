/**
 * Liturgical season color tokens.
 * Derived from professional Catholic publisher analysis (GIA, OCP, WLP).
 * Each season has primary (accent), secondary (background tint), and text variants.
 */

export interface SeasonColors {
  primary: string;       // Accent: season bars, headers, ornaments
  secondary: string;     // Light tint: background fills, subtle borders
  text: string;          // Dark variant for text on white
  onPrimary: string;     // Text on primary background
}

export const SEASON_COLORS: Record<string, SeasonColors> = {
  advent: {
    primary: "#330072",
    secondary: "#EDE5F7",
    text: "#1F0047",
    onPrimary: "#FFFFFF",
  },
  christmas: {
    primary: "#D4AF37",
    secondary: "#FDF6E3",
    text: "#7A6520",
    onPrimary: "#1A1A1A",
  },
  lent: {
    primary: "#7D287D",
    secondary: "#F3E5F3",
    text: "#4A174A",
    onPrimary: "#FFFFFF",
  },
  triduum: {
    primary: "#D4AF37",
    secondary: "#FDF6E3",
    text: "#7A6520",
    onPrimary: "#1A1A1A",
  },
  easter: {
    primary: "#D4AF37",
    secondary: "#FDF6E3",
    text: "#7A6520",
    onPrimary: "#1A1A1A",
  },
  "pentecost": {
    primary: "#C62D25",
    secondary: "#FCE8E7",
    text: "#7A1A16",
    onPrimary: "#FFFFFF",
  },
  "palm-sunday": {
    primary: "#C62D25",
    secondary: "#FCE8E7",
    text: "#7A1A16",
    onPrimary: "#FFFFFF",
  },
  "ordinary-time": {
    primary: "#186420",
    secondary: "#E6F3E8",
    text: "#0E3B12",
    onPrimary: "#FFFFFF",
  },
  "rose": {
    primary: "#EF436D",
    secondary: "#FDE8EE",
    text: "#9B1B3F",
    onPrimary: "#FFFFFF",
  },
  "all-souls": {
    primary: "#382E2B",
    secondary: "#EDEBE9",
    text: "#1A1A1A",
    onPrimary: "#FFFFFF",
  },
};

// Base palette (non-seasonal)
export const BASE_COLORS = {
  text: "#1A1A1A",           // Never pure black (bleeds in print)
  textSecondary: "#57534E",
  textMuted: "#A8A29E",
  background: "#FFFFFF",
  surface: "#FAFAF9",
  border: "#E7E5E4",
  borderStrong: "#D6D3D1",
  rubric: "#C62D25",         // Liturgical rubrics always red
  copyright: "#78716C",      // Small footer text
} as const;
