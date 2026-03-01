import { LiturgicalColor, LiturgicalSeason } from "./types";

export const SEASON_COLORS: Record<
  LiturgicalSeason,
  { primary: string; bg: string; bgLight: string; text: string; label: string }
> = {
  advent: {
    primary: "#6B21A8",
    bg: "bg-purple-800",
    bgLight: "bg-purple-50",
    text: "text-purple-800",
    label: "Advent",
  },
  christmas: {
    primary: "#CA8A04",
    bg: "bg-yellow-600",
    bgLight: "bg-yellow-50",
    text: "text-yellow-700",
    label: "Christmas",
  },
  lent: {
    primary: "#581C87",
    bg: "bg-purple-900",
    bgLight: "bg-purple-50",
    text: "text-purple-900",
    label: "Lent",
  },
  easter: {
    primary: "#CA8A04",
    bg: "bg-yellow-600",
    bgLight: "bg-amber-50",
    text: "text-yellow-700",
    label: "Easter",
  },
  ordinary: {
    primary: "#166534",
    bg: "bg-green-800",
    bgLight: "bg-green-50",
    text: "text-green-800",
    label: "Ordinary Time",
  },
  solemnity: {
    primary: "#991B1B",
    bg: "bg-red-800",
    bgLight: "bg-red-50",
    text: "text-red-800",
    label: "Solemnity",
  },
  feast: {
    primary: "#B91C1C",
    bg: "bg-red-700",
    bgLight: "bg-red-50",
    text: "text-red-700",
    label: "Feast",
  },
};

export function getSeasonColor(season: LiturgicalSeason) {
  return SEASON_COLORS[season] || SEASON_COLORS.ordinary;
}

// ===== Day-level liturgical color maps =====
// Used for calendar enrichment (color band month view, /today page, etc.)

export const LITURGICAL_COLOR_HEX: Record<LiturgicalColor, string> = {
  violet: "#6B21A8",
  white: "#D4A017",
  red: "#B91C1C",
  green: "#166534",
  rose: "#DB2777",
  black: "#1C1917",
};

export const LITURGICAL_COLOR_LIGHT: Record<LiturgicalColor, string> = {
  violet: "#f3e8ff",
  white: "#fefce8",
  red: "#fef2f2",
  green: "#f0fdf4",
  rose: "#fdf2f8",
  black: "#f5f5f4",
};

export const LITURGICAL_COLOR_LABEL: Record<LiturgicalColor, string> = {
  violet: "Violet",
  white: "White",
  red: "Red",
  green: "Green",
  rose: "Rose",
  black: "Black",
};
