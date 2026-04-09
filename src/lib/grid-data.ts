// Data helpers for the Planner grid view

import type { LiturgicalOccasion, MusicPlan, SongEntry } from "./types";
import type {
  GridColumn,
  GridCellData,
  GridRowKey,
  EnsembleId,
  YearCycleFilter,
} from "./grid-types";
import type { LiturgicalSeason } from "./types";

/**
 * Occasions excluded from the Planner grid because they require
 * non-standard liturgical structures (processions, vigils, etc.)
 * and cannot be meaningfully planned in the Sunday Mass grid format.
 */
const PLANNER_EXCLUDED_IDS = new Set([
  "palm-sunday-a",
  "palm-sunday-b",
  "palm-sunday-c",
  "holy-thursday-lords-supper",
  "good-friday-passion",
  "easter-vigil",
]);

/**
 * Filters occasions by year cycle and season.
 */
export function getFilteredOccasions(
  all: LiturgicalOccasion[],
  yearCycle: YearCycleFilter,
  season: LiturgicalSeason | "all"
): LiturgicalOccasion[] {
  let filtered = all;

  // Remove occasions that don't fit the standard Sunday Mass grid
  filtered = filtered.filter((o) => !PLANNER_EXCLUDED_IDS.has(o.id));

  if (yearCycle !== "all") {
    filtered = filtered.filter(
      (o) => o.year === yearCycle || o.year === "ABC"
    );
  }

  if (season !== "all") {
    filtered = filtered.filter((o) => o.season === season);
  }

  // Sort by liturgical calendar position.
  // For season-based occasions (Advent, Lent, Easter, etc.), use season bucket + seasonOrder.
  // For solemnities/feasts, interleave by their nearest date relative to the liturgical year.
  filtered.sort((a, b) => {
    const aPos = getLiturgicalPosition(a);
    const bPos = getLiturgicalPosition(b);
    return aPos - bPos;
  });

  return filtered;
}

/**
 * Builds grid columns from filtered occasions and a selected ensemble.
 */
export function buildGridColumns(
  occasions: LiturgicalOccasion[],
  ensembleId: EnsembleId
): GridColumn[] {
  return occasions.map((occasion) => {
    const plan =
      occasion.musicPlans.find((p) => p.ensembleId === ensembleId) || null;
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
      if (ant) return { title: ant.citation, description: ant.text, isEmpty: false, isReading: true, isVerbatim: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "firstReading": {
      const r = occasion?.readings?.find((rd) => rd.type === "first");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true, isVerbatim: false };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "psalmText": {
      const r = occasion?.readings?.find((rd) => rd.type === "psalm");
      if (r) {
        // Citation may contain "Ps 122:1-2, 3-4\nLet us go rejoicing..."
        // Split at newline: first part is citation, rest is refrain
        const parts = r.citation.split("\n");
        const citation = parts[0];
        const refrain = parts.length > 1
          ? parts.slice(1).join(" ").trim()
          : (r.antiphon && r.antiphon !== r.citation ? r.antiphon : null);
        return { title: citation, description: refrain || undefined, isEmpty: false, isReading: true, isVerbatim: true };
      }
      return { title: "", isEmpty: true, isReading: true };
    }
    case "secondReading": {
      const r = occasion?.readings?.find((rd) => rd.type === "second");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true, isVerbatim: false };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "gospelVerse": {
      const r = occasion?.readings?.find((rd) => rd.type === "gospel_verse");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true, isVerbatim: true };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "gospel": {
      const r = occasion?.readings?.find((rd) => rd.type === "gospel");
      if (r) return { title: r.citation, description: r.summary, isEmpty: false, isReading: true, isVerbatim: false };
      return { title: "", isEmpty: true, isReading: true };
    }
    case "communionAntiphon": {
      const ant = occasion?.antiphons?.find((a) => a.type === "communion");
      if (ant) return { title: ant.citation, description: ant.text, isEmpty: false, isReading: true, isVerbatim: true };
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
    case "sprinklingRite":
      return songToCell(plan.sprinklingRite);
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
          youtubeUrl: plan.responsorialPsalm.youtubeUrl,
        };
      }
      return { title: "", isEmpty: true };
    case "gospelAcclamation":
      if (plan.gospelAcclamation) {
        return {
          title: plan.gospelAcclamation.title,
          composer: plan.gospelAcclamation.composer,
          isEmpty: false,
          youtubeUrl: plan.gospelAcclamation.youtubeUrl,
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
    case "massSettingAmen": {
      // Check for individual sub-row override first
      const subVal = plan[rowKey as keyof typeof plan];
      if (subVal && typeof subVal === "object" && "title" in subVal) {
        return songToCell(subVal as SongEntry);
      }
      // Fall back to parent mass setting
      if (plan.eucharisticAcclamations) {
        return {
          title: plan.eucharisticAcclamations.massSettingName,
          isEmpty: false,
        };
      }
      return { title: "", isEmpty: true };
    }
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
    case "communion4":
      return songToCell(plan.communionSongs?.[3]);
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
    youtubeUrl: song.youtubeUrl,
  };
}

/**
 * Assign a sortable position in the liturgical year.
 * Season-based occasions: use bucket * 1000 + seasonOrder for stable ordering.
 * Solemnities/feasts: interleave by month/day into the liturgical calendar.
 *   - Advent starts the year (~Dec 1), so Dec dates = early positions.
 *   - Mapping: Dec=0, Jan=1, Feb=2, ..., Nov=11 (liturgical year order).
 */
function getLiturgicalPosition(o: { season: string; seasonOrder: number; dates?: { date: string }[] }): number {
  const seasonBuckets: Record<string, number> = {
    advent: 0,
    christmas: 1,
    ordinary: 2,    // OT before Lent (weeks 2-8ish)
    lent: 3,
    holyweek: 4,
    easter: 5,
    // solemnity/feast: computed from date
  };

  const bucket = seasonBuckets[o.season];
  if (bucket !== undefined) {
    return bucket * 1000 + o.seasonOrder;
  }

  // Solemnities and feasts: position by month/day in liturgical year order
  // Find the canonical date (first date in the list, or nearest future)
  const dateStr = o.dates?.[0]?.date;
  if (!dateStr) return 9000 + o.seasonOrder; // fallback: end

  const month = parseInt(dateStr.slice(5, 7), 10); // 1-12
  const day = parseInt(dateStr.slice(8, 10), 10);

  // Liturgical year starts in late November/early December.
  // Map months to liturgical position: Dec=0, Jan=1, ..., Nov=11
  const litMonth = month === 12 ? 0 : month;

  // Interleave into calendar: find which season bucket this date falls into.
  // Dec-Jan = advent/christmas area (bucket 0-1, positions 0-1999)
  // Feb = early OT (bucket 2, ~2000s)
  // Mar-Apr = lent/holy week (bucket 3-4, ~3000-4999)
  // Apr-Jun = easter (bucket 5, ~5000s)
  // Jun-Nov = ordinary time after Pentecost (bucket 6, ~6000s)
  let position: number;
  if (litMonth <= 1) {
    // Dec-Jan: advent/christmas zone
    position = litMonth * 100 + day;
  } else if (litMonth <= 3) {
    // Feb-Mar: lent zone
    position = 3000 + (litMonth - 2) * 100 + day;
  } else if (litMonth <= 6) {
    // Apr-Jun: easter/pentecost zone
    position = 5000 + (litMonth - 4) * 100 + day;
  } else {
    // Jul-Nov: ordinary time after pentecost
    position = 6000 + (litMonth - 7) * 100 + day;
  }

  return position;
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
