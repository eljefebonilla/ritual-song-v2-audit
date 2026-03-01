import type { LiturgicalDay, LiturgicalColor, CelebrationRank, LiturgicalSeason } from "./types";

/**
 * Convert a Supabase snake_case liturgical_days row to a camelCase LiturgicalDay.
 */
export function rowToLiturgicalDay(row: Record<string, unknown>): LiturgicalDay {
  return {
    id: row.id as string,
    date: row.date as string,
    celebrationName: row.celebration_name as string,
    rank: row.rank as CelebrationRank,
    season: row.season as LiturgicalSeason,
    colorPrimary: row.color_primary as LiturgicalColor,
    colorSecondary: (row.color_secondary as LiturgicalColor) || null,
    gloria: row.gloria as boolean,
    alleluia: row.alleluia as boolean,
    lectionaryNumber: (row.lectionary_number as number) || null,
    psalterWeek: (row.psalter_week as string) || null,
    occasionId: (row.occasion_id as string) || null,
    saintName: (row.saint_name as string) || null,
    saintTitle: (row.saint_title as string) || null,
    isHolyday: row.is_holyday as boolean,
    isTransferred: row.is_transferred as boolean,
    ecclesiasticalProvince: (row.ecclesiastical_province as string) || null,
    optionalMemorials: (row.optional_memorials as string[]) || [],
    isBVM: row.is_bvm as boolean,
  };
}

/**
 * Build a lookup map from date string to LiturgicalDay.
 * For dates with multiple entries (e.g. Ascension), returns the __universal__ one.
 */
export function buildLiturgicalDayMap(
  days: LiturgicalDay[]
): Map<string, LiturgicalDay> {
  const map = new Map<string, LiturgicalDay>();
  for (const day of days) {
    const existing = map.get(day.date);
    if (
      !existing ||
      day.ecclesiasticalProvince === "__universal__" ||
      day.ecclesiasticalProvince === null
    ) {
      map.set(day.date, day);
    }
  }
  return map;
}

/**
 * Human-readable rank label.
 */
export function rankLabel(rank: CelebrationRank): string {
  switch (rank) {
    case "solemnity":
      return "Solemnity";
    case "feast":
      return "Feast";
    case "memorial":
      return "Memorial";
    case "optional_memorial":
      return "Opt. Memorial";
    case "sunday":
      return "Sunday";
    case "weekday":
      return "Weekday";
    default:
      return rank;
  }
}

/**
 * Determine if a rank is "significant" enough to show in calendar cells.
 * Returns true for memorial and above.
 */
export function isSignificantRank(rank: CelebrationRank): boolean {
  return rank === "solemnity" || rank === "feast" || rank === "memorial" || rank === "sunday";
}
