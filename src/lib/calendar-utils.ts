// Ensemble display utilities

/**
 * Gets the ensemble display color for badges as inline styles.
 * Uses the canonical hex values from ENSEMBLE_BADGES.
 */
export function getEnsembleColor(ensemble: string | null): { backgroundColor: string; color: string } {
  const COLORS: Record<string, { backgroundColor: string; color: string }> = {
    reflections:  { backgroundColor: "#f1f4f6", color: "#5a6a78" },
    foundations:  { backgroundColor: "#f5e9e5", color: "#8b6b5a" },
    generations:  { backgroundColor: "#fff8da", color: "#8a7a3a" },
    heritage:     { backgroundColor: "#eef1eb", color: "#5a6b54" },
    elevations:   { backgroundColor: "#eeebf6", color: "#6b5a8a" },
  };
  if (!ensemble) return { backgroundColor: "#f5f5f4", color: "#78716c" };
  return COLORS[ensemble.toLowerCase()] || { backgroundColor: "#f5f5f4", color: "#78716c" };
}
