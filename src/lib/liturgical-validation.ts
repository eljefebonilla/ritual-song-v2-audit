import type { LiturgicalDay } from "./types";

export interface ValidationWarning {
  type:
    | "missing_gloria"
    | "alleluia_in_lent"
    | "song_has_alleluia_in_lent"
    | "missing_alleluia_setting"
    | "lenten_gospel_acclamation";
  message: string;
  severity: "error" | "warning";
  songTitle?: string;
}

/**
 * Check if a song title or lyrics text contains "alleluia".
 */
export function songContainsAlleluia(
  title: string,
  lyrics?: string | null
): boolean {
  const lower = title.toLowerCase();
  if (lower.includes("alleluia") || lower.includes("hallelujah")) return true;
  if (lyrics) {
    const lyricsLower = lyrics.toLowerCase();
    if (lyricsLower.includes("alleluia") || lyricsLower.includes("hallelujah"))
      return true;
  }
  return false;
}

/**
 * Determine if we're in Lent (Ash Wednesday through Holy Saturday).
 */
export function isLentenPeriod(day: LiturgicalDay): boolean {
  return !day.alleluia; // alleluia===false is the canonical Lent marker
}

/**
 * Validate a music plan against liturgical rules.
 * Takes the liturgical day and an array of song titles used in the plan.
 */
export function validateMusicPlan(
  day: LiturgicalDay,
  songTitles: string[],
  songAlleluiaFlags?: Map<string, boolean>
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check: Gloria expected but might be missing
  if (day.gloria) {
    // Gloria is expected for this day — just informational, can't verify from titles alone
    // This will be checked against the actual music plan structure if available
  }

  // Check: Gloria NOT expected — warn if someone added one
  // (This is less common, skip for MVP)

  // Check: Alleluia in Lent
  if (isLentenPeriod(day)) {
    for (const title of songTitles) {
      if (songContainsAlleluia(title)) {
        warnings.push({
          type: "song_has_alleluia_in_lent",
          severity: "error",
          message: `"${title}" contains Alleluia — not permitted during Lent`,
          songTitle: title,
        });
      }
    }

    // Check alleluia flags from song_metadata
    if (songAlleluiaFlags) {
      for (const [title, hasAlleluia] of songAlleluiaFlags) {
        if (hasAlleluia && !songContainsAlleluia(title)) {
          // Title doesn't say alleluia but lyrics do
          warnings.push({
            type: "song_has_alleluia_in_lent",
            severity: "error",
            message: `"${title}" contains Alleluia in its lyrics — not permitted during Lent`,
            songTitle: title,
          });
        }
      }
    }

    // Informational: remind about Lenten Gospel Acclamation
    warnings.push({
      type: "lenten_gospel_acclamation",
      severity: "warning",
      message: "Use Lenten Gospel Acclamation (not Alleluia) before the Gospel",
    });
  }

  // Check: Solemnity/Feast/Sunday (outside Advent/Lent) — Gloria expected
  if (
    day.gloria &&
    (day.rank === "solemnity" || day.rank === "feast" || day.rank === "sunday")
  ) {
    warnings.push({
      type: "missing_gloria",
      severity: "warning",
      message: `Gloria is expected for this ${day.rank}`,
    });
  }

  return warnings;
}
