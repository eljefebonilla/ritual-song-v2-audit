// Types specific to the Planner grid view

import type { LiturgicalYear, LiturgicalSeason, LiturgicalOccasion, MusicPlan, SongEntry } from "./types";

export type YearCycleFilter = "A" | "B" | "C" | "all";

export type CommunityId =
  | "reflections"
  | "foundations"
  | "generations"
  | "heritage"
  | "elevations";

export type UserRole = "admin" | "member";

// The row labels for the grid (left-hand column)
export const GRID_ROW_KEYS = [
  "prelude",
  "gathering",
  "penitentialAct",
  "gloria",
  "psalm",
  "gospelAcclamation",
  "offertory",
  "massSetting",
  "lordsPrayer",
  "fractionRite",
  "communion1",
  "communion2",
  "communion3",
  "sending",
] as const;

export type GridRowKey = (typeof GRID_ROW_KEYS)[number];

// Maps row keys to display labels
export const GRID_ROW_LABELS: Record<GridRowKey, string> = {
  prelude: "Prelude",
  gathering: "Gathering",
  penitentialAct: "Penitential Act",
  gloria: "Gloria",
  psalm: "Psalm",
  gospelAcclamation: "Gospel Accl.",
  offertory: "Offertory",
  massSetting: "Mass Setting",
  lordsPrayer: "Lord's Prayer",
  fractionRite: "Fraction Rite",
  communion1: "Communion",
  communion2: "Comm. 2",
  communion3: "Comm. 3",
  sending: "Sending",
};

// Section groupings for visual dividers
export const GRID_SECTIONS = [
  {
    label: "Introductory Rites",
    rows: ["prelude", "gathering", "penitentialAct", "gloria"] as GridRowKey[],
  },
  {
    label: "Liturgy of the Word",
    rows: ["psalm", "gospelAcclamation"] as GridRowKey[],
  },
  {
    label: "Liturgy of the Eucharist",
    rows: [
      "offertory",
      "massSetting",
      "lordsPrayer",
      "fractionRite",
      "communion1",
      "communion2",
      "communion3",
    ] as GridRowKey[],
  },
  {
    label: "Concluding Rites",
    rows: ["sending"] as GridRowKey[],
  },
];

export interface GridFilters {
  yearCycle: YearCycleFilter;
  season: LiturgicalSeason | "all";
  communityId: CommunityId;
  rangeStart: number;
  rangeEnd: number;
}

export interface GridColumn {
  occasion: LiturgicalOccasion;
  plan: MusicPlan | null;
}

export interface GridCellData {
  title: string;
  composer?: string;
  description?: string;
  isEmpty: boolean;
}

export const COMMUNITY_OPTIONS: { id: CommunityId; label: string }[] = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

export const SEASON_OPTIONS: { id: LiturgicalSeason | "all"; label: string }[] = [
  { id: "all", label: "All Seasons" },
  { id: "advent", label: "Advent" },
  { id: "christmas", label: "Christmas" },
  { id: "lent", label: "Lent" },
  { id: "easter", label: "Easter" },
  { id: "ordinary", label: "Ordinary Time" },
  { id: "solemnity", label: "Solemnities" },
  { id: "feast", label: "Feasts" },
];
