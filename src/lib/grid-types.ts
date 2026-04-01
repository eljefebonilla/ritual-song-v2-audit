// Types specific to the Planner grid view

import type { LiturgicalSeason, LiturgicalOccasion, MusicPlan } from "./types";

export type YearCycleFilter = "A" | "B" | "C" | "all";

export type EnsembleId =
  | "reflections"
  | "foundations"
  | "generations"
  | "heritage"
  | "elevations";

export type UserRole = "admin" | "member";

// The row labels for the grid (left-hand column)
// Includes both music rows and reading rows
export const GRID_ROW_KEYS = [
  "prelude",
  "entranceAntiphon",
  "gathering",
  "penitentialAct",
  "gloria",
  "firstReading",
  "psalmText",
  "psalm",
  "secondReading",
  "gospelVerse",
  "gospelAcclamation",
  "gospel",
  "offertory",
  "massSetting",
  "massSettingHoly",
  "massSettingMemorial",
  "massSettingAmen",
  "lordsPrayer",
  "fractionRite",
  "communion1",
  "communion2",
  "communion3",
  "sending",
] as const;

// Sub-rows that expand from massSetting
export const MASS_SETTING_SUB_ROWS: GridRowKey[] = [
  "massSettingHoly",
  "massSettingMemorial",
  "massSettingAmen",
];

export type GridRowKey = (typeof GRID_ROW_KEYS)[number];

// Reading rows — non-editable, styled differently
export const READING_ROWS: Set<GridRowKey> = new Set([
  "entranceAntiphon",
  "firstReading",
  "psalmText",
  "secondReading",
  "gospelVerse",
  "gospel",
]);

// Mass part rows — hideable via toggle
export const MASS_PART_ROWS: Set<GridRowKey> = new Set([
  "penitentialAct",
  "gloria",
  "massSetting",
  "massSettingHoly",
  "massSettingMemorial",
  "massSettingAmen",
  "lordsPrayer",
  "fractionRite",
]);

// Song rows eligible for drag-and-copy (title+composer format)
// Excludes psalm (psalm+setting) and massSetting (massSettingName+composer)
export const SONG_DRAG_ROWS: Set<GridRowKey> = new Set([
  "prelude", "gathering", "penitentialAct", "gloria", "gospelAcclamation",
  "offertory", "lordsPrayer", "fractionRite", "communion1", "communion2",
  "communion3", "sending",
]);

export const SONG_COPY_MIME = "text/x-song-copy";

export interface SongDragPayload {
  title: string;
  composer?: string;
  sourceOccasionId: string;
  sourceRowKey: GridRowKey;
  sourceEnsembleId?: string;
}

// Maps row keys to display labels
export const GRID_ROW_LABELS: Record<GridRowKey, string> = {
  prelude: "Prelude",
  entranceAntiphon: "Entrance Ant.",
  gathering: "Gathering",
  penitentialAct: "Penitential Act",
  gloria: "Gloria",
  firstReading: "1st Reading",
  psalmText: "Psalm Text",
  psalm: "Psalm",
  secondReading: "2nd Reading",
  gospelVerse: "Gospel Verse",
  gospelAcclamation: "Gospel Accl.",
  gospel: "Gospel",
  offertory: "Offertory",
  massSetting: "Mass Setting",
  massSettingHoly: "Holy, Holy",
  massSettingMemorial: "Memorial Accl.",
  massSettingAmen: "Great Amen",
  lordsPrayer: "Lord's Prayer",
  fractionRite: "Fraction Rite",
  communion1: "Communion",
  communion2: "Comm. 2",
  communion3: "Comm. 3",
  sending: "Sending",
};

// Section groupings for visual dividers (interweaved with readings)
export const GRID_SECTIONS = [
  {
    label: "Prelude",
    rows: ["prelude"] as GridRowKey[],
  },
  {
    label: "Introductory Rites",
    rows: ["entranceAntiphon", "gathering", "penitentialAct", "gloria"] as GridRowKey[],
  },
  {
    label: "Liturgy of the Word",
    rows: [
      "firstReading",
      "psalmText",
      "psalm",
      "secondReading",
      "gospelVerse",
      "gospelAcclamation",
      "gospel",
    ] as GridRowKey[],
  },
  {
    label: "Liturgy of the Eucharist",
    rows: [
      "offertory",
      "massSetting",
      "massSettingHoly",
      "massSettingMemorial",
      "massSettingAmen",
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
  ensembleId: EnsembleId;
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
  isReading?: boolean; // true for reading/antiphon rows (non-editable)
  isVerbatim?: boolean; // true when description is verbatim liturgical text (burgundy), false for editorial synopses (blue-grey)
}

export const ENSEMBLE_OPTIONS: { id: EnsembleId; label: string }[] = [
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
  { id: "holyweek", label: "Holy Week" },
  { id: "easter", label: "Easter" },
  { id: "ordinary", label: "Ordinary Time" },
  { id: "solemnity", label: "Solemnities" },
  { id: "feast", label: "Feasts" },
];
