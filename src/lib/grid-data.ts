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
 * For reading rows, pulls from the occasion's readings/antiphons.
 */
export function extractCellData(
  plan: MusicPlan | null,
  rowKey: GridRowKey,
  occasion?: LiturgicalOccasion
): GridCellData {
  // Reading rows — pull from occasion, not plan
  switch (rowKey) {
    case "entranceAntiphon": {
      const ant = occasion?.antiphons?.find((a) => a.type === "entrance");
      if (ant) return { title: ant.text, description: ant.citation, isEmpty: false, isReading: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "firstReading": {
      const r = occasion?.readings?.find((rd) => rd.type === "first");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "psalmText": {
      const r = occasion?.readings?.find((rd) => rd.type === "psalm");
      if (r) return { title: r.antiphon || r.citation, description: r.summary, isEmpty: false, isReading: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "secondReading": {
      const r = occasion?.readings?.find((rd) => rd.type === "second");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "gospelVerse": {
      const r = occasion?.readings?.find((rd) => rd.type === "gospel_verse");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "gospel": {
      const r = occasion?.readings?.find((rd) => rd.type === "gospel");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true };
      return { title: "", isEmpty: true, isReading: true };
    }
  }

  // Music rows — pull from plan
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
    case "massSettingHoly":
    case "massSettingMemorial":
    case "massSettingAmen":
      // Sub-rows inherit from the mass setting
      if (plan.eucharisticAcclamations) {
        return {
          title: plan.eucharisticAcclamations.massSettingName,
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
  const todayISO = new Date().toISOString().split("T")[0];

  // Find the occasion with the soonest upcoming date (>= today).
  // This represents "this week" in the liturgical calendar.
  let bestIdx = -1;
  let bestDate = "";

  for (let i = 0; i < occasions.length; i++) {
    const occ = occasions[i];
    if (!occ.dates || occ.dates.length === 0) continue;

    // Find this occasion's nearest future date
    let nearestFuture = "";
    for (const d of occ.dates) {
      if (d.date >= todayISO && (nearestFuture === "" || d.date < nearestFuture)) {
        nearestFuture = d.date;
      }
    }
    if (!nearestFuture) continue;

    // Track the occasion with the smallest (soonest) future date
    if (bestDate === "" || nearestFuture < bestDate) {
      bestDate = nearestFuture;
      bestIdx = i;
    }
  }

  return bestIdx >= 0 ? bestIdx : 0;
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
