"use client";

import { useContext } from "react";
import { ThemeContext, type WorshipAidTheme } from "./ThemeProvider";

/**
 * Access the current liturgical season theme.
 * Must be used inside a <ThemeProvider>.
 */
export function useTheme(): WorshipAidTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}
