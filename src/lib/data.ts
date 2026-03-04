import type { LiturgicalOccasion, LiturgicalYear, LiturgicalSeason, SeasonGroup, LectionarySynopsis } from "./types";
import allOccasionsData from "../data/all-occasions.json";
import seasonsData from "../data/seasons.json";
import calendarData from "../data/calendar.json";
import synopsesData from "../data/lectionary-synopses.json";

export interface OccasionSummary {
  id: string;
  name: string;
  year: LiturgicalYear;
  season: LiturgicalSeason;
  secondarySeason?: LiturgicalSeason;
  seasonLabel: string;
  seasonOrder: number;
  nextDate: string | null;
  nextDates?: { a: string; b: string; c: string };
}

const typedOccasions = allOccasionsData as OccasionSummary[];
const typedSynopses = synopsesData as Record<string, LectionarySynopsis>;

export function getAllOccasions(): OccasionSummary[] {
  return typedOccasions;
}

export function getSeasons(): SeasonGroup[] {
  return seasonsData as SeasonGroup[];
}

export function getCalendar() {
  return calendarData as { thisWeek: string | null; nextWeek: string | null };
}

export function getOccasion(id: string): LiturgicalOccasion | null {
  try {
    const data = require(`../data/occasions/${id}.json`);
    // Normalize legacy communityId → ensembleId in music plans
    if (data.musicPlans) {
      for (const plan of data.musicPlans) {
        if (!plan.ensembleId && plan.communityId) {
          plan.ensembleId = plan.communityId;
        }
        if (!plan.ensemble && plan.community) {
          plan.ensemble = plan.community;
        }
      }
    }
    return data as LiturgicalOccasion;
  } catch {
    return null;
  }
}

export function getOccasionsByseason(season: string): OccasionSummary[] {
  return typedOccasions.filter(
    (o) => o.season === season || o.secondarySeason === season
  );
}

export function getCurrentWeekOccasions() {
  const cal = getCalendar();
  const thisWeekId = cal.thisWeek;
  const nextWeekId = cal.nextWeek;

  let thisWeek: LiturgicalOccasion | null = null;
  let nextWeek: LiturgicalOccasion | null = null;

  if (thisWeekId) thisWeek = getOccasion(thisWeekId);
  if (nextWeekId) nextWeek = getOccasion(nextWeekId);

  return { thisWeek, nextWeek };
}

/**
 * Load ALL full occasion data (with music plans).
 * Used by the Planner grid view.
 */
export function getAllFullOccasions(): LiturgicalOccasion[] {
  return typedOccasions
    .map((summary) => getOccasion(summary.id))
    .filter(Boolean) as LiturgicalOccasion[];
}

export function getSynopsis(id: string): LectionarySynopsis | null {
  return typedSynopses[id] ?? null;
}

export function getAllSynopses(): Record<string, LectionarySynopsis> {
  return typedSynopses;
}
