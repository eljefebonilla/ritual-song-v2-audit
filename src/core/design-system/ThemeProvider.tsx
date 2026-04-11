"use client";

import { createContext, useMemo } from "react";
import { SEASON_COLORS, BASE_COLORS, type SeasonColors } from "./tokens/colors";
import { FONT_FAMILIES, FONT_SIZES, LINE_HEIGHTS } from "./tokens/typography";

export interface WorshipAidTheme {
  season: string;
  colors: SeasonColors;
  base: typeof BASE_COLORS;
  fonts: typeof FONT_FAMILIES;
  sizes: typeof FONT_SIZES;
  lineHeights: typeof LINE_HEIGHTS;
  cssVariables: Record<string, string>;
}

export const ThemeContext = createContext<WorshipAidTheme | null>(null);

function buildCssVariables(season: string): Record<string, string> {
  const colors = SEASON_COLORS[season] ?? SEASON_COLORS["ordinary-time"];
  return {
    "--wa-primary": colors.primary,
    "--wa-secondary": colors.secondary,
    "--wa-text-accent": colors.text,
    "--wa-on-primary": colors.onPrimary,
    "--wa-text": BASE_COLORS.text,
    "--wa-text-secondary": BASE_COLORS.textSecondary,
    "--wa-text-muted": BASE_COLORS.textMuted,
    "--wa-rubric": BASE_COLORS.rubric,
    "--wa-copyright": BASE_COLORS.copyright,
    "--wa-border": BASE_COLORS.border,
    "--wa-surface": BASE_COLORS.surface,
    "--wa-font-body": FONT_FAMILIES.body,
    "--wa-font-heading": FONT_FAMILIES.heading,
    "--wa-size-h1": `${FONT_SIZES.h1}pt`,
    "--wa-size-h2": `${FONT_SIZES.h2}pt`,
    "--wa-size-h3": `${FONT_SIZES.h3}pt`,
    "--wa-size-body": `${FONT_SIZES.body}pt`,
    "--wa-size-caption": `${FONT_SIZES.caption}pt`,
    "--wa-size-copyright": `${FONT_SIZES.copyright}pt`,
  };
}

interface ThemeProviderProps {
  season: string;
  children: React.ReactNode;
}

export function ThemeProvider({ season, children }: ThemeProviderProps) {
  const theme = useMemo((): WorshipAidTheme => {
    const colors = SEASON_COLORS[season] ?? SEASON_COLORS["ordinary-time"];
    return {
      season,
      colors,
      base: BASE_COLORS,
      fonts: FONT_FAMILIES,
      sizes: FONT_SIZES,
      lineHeights: LINE_HEIGHTS,
      cssVariables: buildCssVariables(season),
    };
  }, [season]);

  const styleTag = useMemo(() => {
    const vars = Object.entries(theme.cssVariables)
      .map(([k, v]) => `${k}: ${v};`)
      .join("\n    ");
    return `:root {\n    ${vars}\n  }`;
  }, [theme.cssVariables]);

  return (
    <ThemeContext.Provider value={theme}>
      <style>{styleTag}</style>
      {children}
    </ThemeContext.Provider>
  );
}
