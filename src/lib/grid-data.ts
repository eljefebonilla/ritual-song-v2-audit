// Data helpers for the Planner grid view

import type { LiturgicalOccasion, MusicPlan, SongEntry } from "./types";
import type {
  GridColumn,
  GridCellData,
  GridRowKey,
  CommunityId,
  YearCycleFilter,
} from "./grid-types";
import type { LiturgicalSeason } from "./types";

/**
 * Filters occasions by year cycle and season.
 */
export function getFilteredOccasions(
  all: LiturgicalOccasion[],
  yearCycle: YearCycleFilter,
  season: LiturgicalSeason | "all"
): LiturgicalOccasion[] {
  let filtered = all;

  if (yearCycle !== "all") {
    filtered = filtered.filter(
      (o) => o.year === yearCycle || o.year === "ABC"
    );
  }

  if (season !== "all") {
    filtered = filtered.filter((o) => o.season === season);
  }

  filtered.sort((a, b) => {
    const seasonOrder = getSeasonSortOrder(a.season) - getSeasonSortOrder(b.season);
    if (seasonOrder !== 0) return seasonOrder;
    return a.seasonOrder - b.seasonOrder;
  });

  return filtered;
}

/**
 * Builds grid columns from filtered occasions and a selected community.
 */
export function buildGridColumns(
  occasions: LiturgicalOccasion[],
  communityId: CommunityId
): GridColumn[] {
  return occasions.map((occasion) => {
    const plan =
      occasion.musicPlans.find((p) => p.communityId === communityId) || null;
    return { occasion, plan };
  });
}

/**
 * Extracts the cell data for a given row key from a music plan.
 */
export function extractCellData(
  plan: MusicPlan | null,
  rowKey: GridRowKey
): GridCellData {
  if (!plan) {
    return { title: "", isEmpty: true };
  }

  switch (rowKey) {
    case "prelude":
      return songToCell(plan.prelude);
    case "gathering":
      return songToCell(plan.gathering);
    case "penitentialAct":
      return songToCell(plan.penitentialAct);
    case "gloria":
      return songToCell(plan.gloria);
    case "psalm":
      if (plan.responsorialPsalm) {
        return {
          title: plan.responsorialPsalm.psalm,
          composer: plan.responsorialPsalm.setting,
          isEmpty: false,
        };
      }
      return { title: "", isEmpty: true };
    case "gospelAcclamation":
      if (plan.gospelAcclamation) {
        return {
          title: plan.gospelAcclamation.title,
          composer: plan.gospelAcclamation.composer,
          description: plan.gospelAcclamation.verse,
          isEmpty: false,
        };
      }
      return { title: "", isEmpty: true };
    case "offertory":
      return songToCell(plan.offertory);
    case "massSetting":
      if (plan.eucharisticAcclamations) {
        return {
          title: plan.eucharisticAcclamations.massSettingName,
          composer: plan.eucharisticAcclamations.composer,
          isEmpty: false,
        };
      }
      return { title: "", isEmpty: true };
    case "lordsPrayer":
      return songToCell(plan.lordsPrayer);
    case "fractionRite":
      return songToCell(plan.fractionRite);
    case "communion1":
      return songToCell(plan.communionSongs?.[0]);
    case "communion2":
      return songToCell(plan.communionSongs?.[1]);
    case "communion3":
      return songToCell(plan.communionSongs?.[2]);
    case "sending":
      return songToCell(plan.sending);
    default:
      return { title: "", isEmpty: true };
  }
}

function songToCell(song?: SongEntry): GridCellData {
  if (!song) {
    return { title: "", isEmpty: true };
  }
  return {
    title: song.title,
    composer: song.composer,
    description:
      song.description && song.description !== "Description"
        ? song.description
        : undefined,
    isEmpty: false,
  };
}

function getSeasonSortOrder(season: string): number {
  const order: Record<string, number> = {
    advent: 0,
    christmas: 1,
    ordinary: 2,
    lent: 3,
    easter: 4,
    solemnity: 5,
    feast: 6,
  };
  return order[season] ?? 99;
}

/**
 * Find the index of the first occasion whose next date is >= the next upcoming Sunday.
 * Used by the planner's "hide past weeks" feature.
 */
export function findNextUpcomingSundayIndex(
  occasions: LiturgicalOccasion[]
): number {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  const nextSundayISO = nextSunday.toISOString().split("T")[0];

  for (let i = 0; i < occasions.length; i++) {
    const occ = occasions[i];
    const futureDate = occ.dates.find((d) => d.date >= nextSundayISO);
    if (futureDate) return i;
  }
  return 0; // fallback: show from beginning
}

/**
 * Get nearest future date string for an occasion, or the first available date.
 */
export function getOccasionDisplayDate(occasion: LiturgicalOccasion): string {
  const today = new Date().toISOString().split("T")[0];
  const futureDate = occasion.dates.find((d) => d.date >= today);
  if (futureDate) {
    return new Date(futureDate.date + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  if (occasion.dates.length > 0) {
    return new Date(
      occasion.dates[0].date + "T12:00:00"
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  return "";
}
